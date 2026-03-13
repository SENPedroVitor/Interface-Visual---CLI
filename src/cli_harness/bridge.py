from __future__ import annotations

import json
import os
import pty
import shlex
import signal
import subprocess
import sys
import termios
import threading
from typing import Optional

from .backend_commands import resolve_backend_command
from .history import HistoryStore


class ReplBridge:
    def __init__(self) -> None:
        self.proc: Optional[subprocess.Popen] = None
        self.master_fd: Optional[int] = None
        self.reader: Optional[threading.Thread] = None
        self.store = HistoryStore.open()
        self.session_id: Optional[int] = None
        self.backend_name: Optional[str] = None
        self.command_label: Optional[str] = None

    def _emit(self, payload: dict) -> None:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()

    def _reader_loop(self) -> None:
        if self.master_fd is None:
            return
        while True:
            try:
                data = os.read(self.master_fd, 1024)
            except OSError:
                break
            if not data:
                break
            text = data.decode("utf-8", errors="replace")
            if self.store and self.session_id is not None:
                self.store.log_event(self.session_id, "out", text)
            self._emit({"type": "output", "data": text})

    def start(self, backend: str, command: str) -> None:
        self.stop()
        self.backend_name = backend
        self.command_label = command

        master_fd, slave_fd = pty.openpty()
        attrs = termios.tcgetattr(slave_fd)
        attrs[3] &= ~termios.ECHO
        termios.tcsetattr(slave_fd, termios.TCSANOW, attrs)
        self.master_fd = master_fd
        self.proc = subprocess.Popen(
            shlex.split(command),
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)

        if self.store:
            self.session_id = self.store.start_session(backend, command)

        self.reader = threading.Thread(target=self._reader_loop, daemon=True)
        self.reader.start()

        self._emit({"type": "started", "backend": backend})

    def send(self, data: str) -> None:
        if not self.master_fd:
            return
        if self.store and self.session_id is not None:
            self.store.log_event(self.session_id, "in", data)
        os.write(self.master_fd, data.encode("utf-8"))

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.send_signal(signal.SIGTERM)
            except Exception:
                pass
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass
        if self.store and self.session_id is not None:
            self.store.end_session(self.session_id)
        self.proc = None
        self.master_fd = None
        self.reader = None
        self.session_id = None
        self.backend_name = None
        self.command_label = None


def main() -> None:
    bridge = ReplBridge()
    bridge._emit({"type": "ready"})
    for line in sys.stdin:
        try:
            payload = json.loads(line.strip() or "{}")
        except json.JSONDecodeError:
            continue

        msg_type = payload.get("type")
        if msg_type == "start":
            backend = payload.get("backend", "codex")
            command = resolve_backend_command(backend, payload.get("command"))
            bridge.start(backend, command)
        elif msg_type == "send":
            data = payload.get("data", "")
            bridge.send(data)
        elif msg_type == "stop":
            bridge.stop()
        elif msg_type == "exit":
            bridge.stop()
            break


if __name__ == "__main__":
    main()
