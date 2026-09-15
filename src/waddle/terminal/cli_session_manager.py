"""Safe, pipe-based sessions for locally authenticated coding CLIs.

This module deliberately does not use a shell or a pseudo-terminal.  The
browser/API layer can feed input to a session and consume ``SessionEvent``
objects from ``poll_events`` (or register a callback), while authentication
remains owned by the local Codex/Claude installation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
import queue
import shlex
import shutil
import signal
import subprocess
import threading
import time
import uuid
from typing import Callable, Optional, Sequence


ALLOWED_PROVIDERS = frozenset({"codex", "claude"})
DEFAULT_OUTPUT_LIMIT = 1_000_000
DEFAULT_TIMEOUT_SECONDS = 30 * 60
SANDBOX_MODES = frozenset({"read-only", "workspace-write", "danger-full-access"})


@dataclass(frozen=True)
class SessionEvent:
    """A stream event safe to forward to a websocket client."""

    session_id: str
    provider: str
    kind: str  # stdout, stderr, exited, timeout, error
    text: str = ""
    exit_code: Optional[int] = None
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class SessionState:
    session_id: str
    provider: str
    cwd: str
    running: bool
    started_at: float
    output_bytes: int


@dataclass
class _Session:
    session_id: str
    provider: str
    cwd: Path
    process: subprocess.Popen[bytes]
    started_at: float
    output_limit: int
    timeout_seconds: float
    one_shot: bool = False
    output_bytes: int = 0
    running: bool = True
    stop_requested: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)


class CliSessionManager:
    """Manage bounded local Codex/Claude processes without shell execution.

    ``authorized_workspace`` is the root for all allowed working directories.
    Every session has a process group and a lifetime timeout; stopping a
    session terminates the complete process tree on Windows and POSIX.
    """

    def __init__(
        self,
        authorized_workspace: Path | str | None = None,
        *,
        env: Optional[dict[str, str]] = None,
        output_limit: int = DEFAULT_OUTPUT_LIMIT,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        sandbox_mode: str = "read-only",
        popen: Callable[..., subprocess.Popen] = subprocess.Popen,
    ) -> None:
        workspace = Path(authorized_workspace or Path.cwd()).expanduser().resolve()
        if not workspace.is_dir():
            raise ValueError(f"Workspace autorizado não existe: {workspace}")
        if output_limit <= 0:
            raise ValueError("output_limit deve ser maior que zero")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds deve ser maior que zero")
        if sandbox_mode not in SANDBOX_MODES:
            raise ValueError("sandbox_mode inválido")
        self.authorized_workspace = workspace
        self._env = dict(env) if env is not None else dict(os.environ)
        self.output_limit = output_limit
        self.timeout_seconds = timeout_seconds
        self.sandbox_mode = sandbox_mode
        self._popen = popen
        self._sessions: dict[str, _Session] = {}
        self._events: queue.Queue[SessionEvent] = queue.Queue()
        self._callbacks: list[Callable[[SessionEvent], None]] = []
        self._lock = threading.RLock()

    def add_callback(self, callback: Callable[[SessionEvent], None]) -> None:
        """Subscribe to events. Callback failures never stop a CLI reader."""
        with self._lock:
            self._callbacks.append(callback)

    def remove_callback(self, callback: Callable[[SessionEvent], None]) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def start_session(
        self,
        provider: str,
        *,
        cwd: Path | str | None = None,
        timeout_seconds: Optional[float] = None,
        output_limit: Optional[int] = None,
    ) -> str:
        provider = provider.strip().lower()
        if provider not in ALLOWED_PROVIDERS:
            raise ValueError("provider deve ser 'codex' ou 'claude'")
        target = self._validate_cwd(cwd)
        command = self._prepare_command(self.resolve_command(provider))
        session_id = uuid.uuid4().hex
        timeout = timeout_seconds if timeout_seconds is not None else self.timeout_seconds
        limit = output_limit if output_limit is not None else self.output_limit
        if timeout <= 0 or limit <= 0:
            raise ValueError("timeout_seconds e output_limit devem ser maiores que zero")

        creationflags = 0
        kwargs: dict[str, object] = {}
        if os.name == "nt":
            creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            kwargs["creationflags"] = creationflags
        else:
            kwargs["start_new_session"] = True
        try:
            process = self._popen(
                command,
                cwd=str(target),
                env=dict(self._env),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                **kwargs,
            )
        except (OSError, ValueError) as exc:
            self._publish(SessionEvent(session_id, provider, "error", str(exc)))
            raise RuntimeError(f"Não foi possível iniciar {provider}: {exc}") from exc

        session = _Session(
            session_id=session_id,
            provider=provider,
            cwd=target,
            process=process,
            started_at=time.monotonic(),
            output_limit=limit,
            timeout_seconds=timeout,
            one_shot=(provider == "codex" and "exec" in command) or (provider == "claude" and "-p" in command),
        )
        with self._lock:
            self._sessions[session_id] = session
        for stream_name, stream in (("stdout", process.stdout), ("stderr", process.stderr)):
            thread = threading.Thread(
                target=self._read_stream,
                args=(session, stream_name, stream),
                name=f"waddle-cli-{provider}-{stream_name}",
                daemon=True,
            )
            thread.start()
        threading.Thread(target=self._watch_session, args=(session,), daemon=True).start()
        return session_id

    def send_input(self, session_id: str, text: str) -> None:
        session = self._get_session(session_id)
        if not session.running or session.process.stdin is None:
            raise RuntimeError("Sessão não está em execução")
        if not isinstance(text, str):
            raise TypeError("text deve ser uma string")
        try:
            session.process.stdin.write(text.encode("utf-8"))
            session.process.stdin.flush()
            if session.one_shot:
                session.process.stdin.close()
        except (BrokenPipeError, OSError) as exc:
            raise RuntimeError("A sessão encerrou o stdin") from exc

    def stop_session(self, session_id: str, *, reason: str = "stopped") -> None:
        session = self._get_session(session_id)
        with session.lock:
            if not session.running:
                return
            session.stop_requested = True
        self._terminate_process_tree(session.process)
        self._publish(SessionEvent(session.session_id, session.provider, "error", reason))

    def poll_events(self, *, max_events: int = 100) -> list[SessionEvent]:
        events: list[SessionEvent] = []
        for _ in range(max(0, max_events)):
            try:
                events.append(self._events.get_nowait())
            except queue.Empty:
                break
        return events

    def list_sessions(self) -> list[SessionState]:
        with self._lock:
            sessions = list(self._sessions.values())
        return [
            SessionState(s.session_id, s.provider, str(s.cwd), s.running, s.started_at, s.output_bytes)
            for s in sessions
        ]

    def resolve_command(self, provider: str) -> list[str]:
        provider = provider.lower()
        if provider not in ALLOWED_PROVIDERS:
            raise ValueError("provider deve ser 'codex' ou 'claude'")
        configured = self._env.get(f"{provider.upper()}_CMD", "").strip()
        if configured:
            command = self._split_command(configured)
            if not command:
                raise ValueError(f"{provider.upper()}_CMD está vazio")
            return command
        executable = shutil.which(provider, path=self._env.get("PATH"))
        if not executable:
            raise FileNotFoundError(f"{provider} CLI não encontrado no PATH")
        # The default interactive TUIs require a real ConPTY.  The web bridge
        # intentionally uses pipe-based sessions, so prefer each CLI's
        # non-interactive stdin mode unless the user supplied an explicit
        # command override.
        if provider == "codex":
            return [executable, "exec", "--ephemeral", "-s", self.sandbox_mode, "-"]
        return [executable, "-p", "--permission-mode", "plan"]

    def _validate_cwd(self, cwd: Path | str | None) -> Path:
        target = (Path(cwd) if cwd is not None else self.authorized_workspace).expanduser().resolve()
        try:
            target.relative_to(self.authorized_workspace)
        except ValueError as exc:
            raise PermissionError("cwd precisa estar dentro do workspace autorizado") from exc
        if not target.is_dir():
            raise FileNotFoundError(f"cwd não existe: {target}")
        return target

    @staticmethod
    def _split_command(command: str) -> list[str]:
        # posix=False preserves Windows paths and quoted arguments.
        return shlex.split(command, posix=False)

    @staticmethod
    def _prepare_command(command: list[str]) -> list[str]:
        """Make npm-installed ``.cmd`` CLIs executable without ``shell=True``."""
        if os.name == "nt" and command and Path(command[0].strip('"')).suffix.lower() in {".cmd", ".bat"}:
            comspec = os.environ.get("COMSPEC", "cmd.exe")
            return [comspec, "/d", "/s", "/c", subprocess.list2cmdline(command)]
        return command

    def _read_stream(self, session: _Session, kind: str, stream: object) -> None:
        if stream is None:
            return
        try:
            while True:
                chunk = stream.readline()  # type: ignore[attr-defined]
                if not chunk:
                    return
                if isinstance(chunk, str):
                    data = chunk.encode("utf-8", errors="replace")
                else:
                    data = bytes(chunk)
                with session.lock:
                    remaining = session.output_limit - session.output_bytes
                    if remaining <= 0:
                        continue
                    clipped = data[:remaining]
                    session.output_bytes += len(clipped)
                if clipped:
                    self._publish(SessionEvent(session.session_id, session.provider, kind, clipped.decode("utf-8", errors="replace")))
        except (OSError, ValueError):
            return

    def _watch_session(self, session: _Session) -> None:
        timed_out = False
        while session.process.poll() is None:
            if time.monotonic() - session.started_at >= session.timeout_seconds:
                timed_out = True
                with session.lock:
                    session.stop_requested = True
                self._terminate_process_tree(session.process)
                self._publish(SessionEvent(session.session_id, session.provider, "timeout", "Sessão excedeu o tempo limite."))
                break
            time.sleep(0.05)
        try:
            exit_code = session.process.wait(timeout=2)
        except (subprocess.TimeoutExpired, OSError):
            self._terminate_process_tree(session.process)
            exit_code = session.process.poll()
        with session.lock:
            session.running = False
        self._close_process_streams(session.process)
        self._publish(SessionEvent(session.session_id, session.provider, "exited", "", exit_code=exit_code))

    def _get_session(self, session_id: str) -> _Session:
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Sessão desconhecida: {session_id}")
        return session

    def _publish(self, event: SessionEvent) -> None:
        self._events.put(event)
        with self._lock:
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback(event)
            except Exception:
                continue

    @staticmethod
    def _terminate_process_tree(process: subprocess.Popen) -> None:
        if process.poll() is not None:
            return
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=5,
                )
            else:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except (OSError, subprocess.SubprocessError):
            try:
                process.kill()
            except OSError:
                pass

    @staticmethod
    def _close_process_streams(process: subprocess.Popen) -> None:
        for stream_name in ("stdin", "stdout", "stderr"):
            stream = getattr(process, stream_name, None)
            close = getattr(stream, "close", None)
            if close is not None:
                try:
                    close()
                except OSError:
                    pass
