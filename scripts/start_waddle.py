"""Supervised local launcher for the Waddle Agent OS.

Starts the API, web interface and (when available) Ollama, waits for readiness,
opens the browser only after the stack is usable, and cleans up child processes
together. The launcher intentionally keeps cloud providers optional.
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import Iterable, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
WEB_DIR = PROJECT_ROOT / "web"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inicia e supervisiona o Waddle Agent OS local.")
    parser.add_argument("--headless", "--no-browser", dest="no_browser", action="store_true", help="não abrir o navegador")
    parser.add_argument("--no-ollama", action="store_true", help="não iniciar o Ollama automaticamente")
    parser.add_argument("--production", action="store_true", help="usar web/dist com Vite preview, sem hot-reload")
    parser.add_argument("--no-restart", action="store_true", help="não reiniciar um serviço que cair")
    parser.add_argument("--backend-host", default=os.getenv("WADDLE_BACKEND_HOST", "127.0.0.1"))
    parser.add_argument("--backend-port", type=int, default=_env_int("WADDLE_BACKEND_PORT", 8000))
    parser.add_argument("--frontend-host", default=os.getenv("WADDLE_FRONTEND_HOST", "127.0.0.1"))
    parser.add_argument("--frontend-port", type=int, default=_env_int("WADDLE_FRONTEND_PORT", 5173))
    parser.add_argument("--readiness-timeout", type=float, default=float(os.getenv("WADDLE_READINESS_TIMEOUT", "30")))
    parser.add_argument("--restart-limit", type=int, default=_env_int("WADDLE_RESTART_LIMIT", 3))
    return parser


def _url(host: str, port: int, path: str = "") -> str:
    return f"http://{host}:{port}{path}"


def wait_for_http(url: str, timeout: float = 30.0, interval: float = 0.25) -> bool:
    """Poll a local HTTP endpoint until it responds with a 2xx status."""
    deadline = time.monotonic() + max(0.1, timeout)
    while time.monotonic() < deadline:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "WaddleLauncher/1.0"})
            with urllib.request.urlopen(request, timeout=min(2.0, max(0.2, deadline - time.monotonic()))) as response:
                if 200 <= response.status < 300:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(interval)
    return False


def port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.3):
            return True
    except OSError:
        return False


def kill_process_tree(proc: Optional[subprocess.Popen]) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        if sys.platform.startswith("win"):
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _resolve_npm(env: dict[str, str]) -> Optional[str]:
    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    if npm_path:
        return npm_path
    if not sys.platform.startswith("win"):
        return None
    user_profile = os.environ.get("USERPROFILE", "")
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    app_data = os.environ.get("APPDATA", "")
    candidates = [
        Path(local_app_data) / "JetBrains" / "GoLand2026.2" / "acp-agents" / ".runtimes" / "node" / "24.13.0",
        Path(local_app_data) / "OpenAI" / "Codex" / "runtimes" / "cua_node" / "e7fe122ad3cbcd58" / "bin",
        Path(user_profile) / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "node" / "bin",
        Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "nodejs",
        Path(app_data) / "npm",
    ]
    for candidate_dir in candidates:
        candidate = candidate_dir / "npm.cmd"
        if candidate.exists():
            env["PATH"] = f"{candidate_dir}{os.pathsep}{env.get('PATH', '')}"
            return str(candidate)
    return None


def _resolve_ollama() -> Optional[str]:
    configured = os.getenv("OLLAMA_BIN")
    candidates = [Path(configured)] if configured else []
    if sys.platform.startswith("win"):
        candidates.append(Path.home() / "AppData" / "Local" / "Programs" / "OllamaPortable" / "ollama.exe")
    candidates.extend([Path(shutil.which("ollama"))] if shutil.which("ollama") else [])
    for candidate in candidates:
        if candidate and candidate.exists():
            return str(candidate)
    return None


def _ollama_ready() -> bool:
    return wait_for_http(os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/") + "/api/tags", timeout=0.5, interval=0.1)


def _popen(command: list[str], *, cwd: Path, env: dict[str, str], shell: bool = False) -> subprocess.Popen:
    creationflags = 0
    if sys.platform.startswith("win"):
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    return subprocess.Popen(command, cwd=str(cwd), env=env, shell=shell, creationflags=creationflags)


def _wait_service(name: str, url: str, proc: subprocess.Popen, timeout: float) -> None:
    if wait_for_http(url, timeout=timeout):
        return
    code = proc.poll()
    if code is not None:
        raise RuntimeError(f"{name} encerrou durante a inicialização (código {code}).")
    raise RuntimeError(f"{name} não respondeu em {url} após {timeout:.0f}s.")


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = build_parser().parse_args(list(argv) if argv is not None else None)
    if args.backend_port < 1 or args.frontend_port < 1:
        print("[ERRO] As portas precisam ser maiores que zero.", file=sys.stderr)
        return 2

    env = dict(os.environ)
    env["PYTHONPATH"] = f"{SRC_DIR}{os.pathsep}{env.get('PYTHONPATH', '')}".rstrip(os.pathsep)
    # Vite reads these values when building its dev proxy. Keep custom API
    # ports aligned with the supervised backend process.
    env["WADDLE_BACKEND_HOST"] = args.backend_host
    env["WADDLE_BACKEND_PORT"] = str(args.backend_port)
    backend_proc: Optional[subprocess.Popen] = None
    frontend_proc: Optional[subprocess.Popen] = None
    ollama_proc: Optional[subprocess.Popen] = None
    reused_backend = False
    reused_frontend = False
    restart_counts = {"backend": 0, "frontend": 0}

    backend_base = _url(args.backend_host, args.backend_port)
    frontend_base = _url(args.frontend_host, args.frontend_port)

    def cleanup() -> None:
        for proc in (frontend_proc, backend_proc, ollama_proc):
            kill_process_tree(proc)

    def handle_signal(_sig: int, _frame: object) -> None:
        cleanup()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    try:
        print("=" * 64)
        print("  [WADDLE] AGENT OS — runtime local supervisionado")
        print("=" * 64)

        if not args.no_ollama and not _ollama_ready():
            ollama_bin = _resolve_ollama()
            if ollama_bin:
                print("[1/3] Iniciando Ollama local...")
                ollama_proc = _popen([ollama_bin, "serve"], cwd=PROJECT_ROOT, env=env)
                if not wait_for_http(os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/") + "/api/tags", timeout=min(15.0, args.readiness_timeout)):
                    print("[AVISO] Ollama não respondeu; o fallback local continua disponível.")
            else:
                print("[AVISO] Ollama não encontrado; continuando com fallback local.")
        elif args.no_ollama:
            print("[1/3] Ollama desativado por opção.")
        else:
            print("[1/3] Ollama já está respondendo.")

        if wait_for_http(f"{backend_base}/health", timeout=0.8):
            reused_backend = True
            print(f"[2/3] API já disponível em {backend_base}.")
        else:
            if port_is_open(args.backend_host, args.backend_port):
                raise RuntimeError(f"A porta da API {args.backend_host}:{args.backend_port} está ocupada e não respondeu em /health.")
            backend_cmd = [
                sys.executable, "-m", "uvicorn", "--app-dir", "src", "waddle.api.server:app",
                "--host", args.backend_host, "--port", str(args.backend_port),
            ]
            backend_proc = _popen(backend_cmd, cwd=PROJECT_ROOT, env=env)
            _wait_service("API FastAPI", f"{backend_base}/health", backend_proc, args.readiness_timeout)
            print(f"[2/3] API pronta em {backend_base}.")

        npm_path = _resolve_npm(env)
        if not WEB_DIR.exists():
            raise RuntimeError("A pasta web/ não existe; não foi possível iniciar a interface.")
        if args.production and not (WEB_DIR / "dist").exists():
            raise RuntimeError("Modo production exige web/dist. Rode 'cd web; npm run build' antes.")
        if wait_for_http(frontend_base, timeout=0.8):
            reused_frontend = True
            print(f"[3/3] Interface já disponível em {frontend_base}.")
        else:
            if not npm_path:
                raise RuntimeError("npm não foi encontrado; instale Node.js ou configure o runtime do Node.")
            if port_is_open(args.frontend_host, args.frontend_port):
                raise RuntimeError(f"A porta da interface {args.frontend_host}:{args.frontend_port} está ocupada e não respondeu.")
            npm_args = ["run", "preview" if args.production else "dev", "--", "--host", args.frontend_host, "--port", str(args.frontend_port)]
            shell = sys.platform.startswith("win") and npm_path.lower().endswith((".cmd", ".bat"))
            frontend_proc = _popen([npm_path, *npm_args], cwd=WEB_DIR, env=env, shell=shell)
            _wait_service("Interface Vite", frontend_base, frontend_proc, args.readiness_timeout)
            print(f"[3/3] Interface pronta em {frontend_base}.")

        print("\n[OK] Waddle Agent OS está rodando.")
        print(f"  Interface: {frontend_base}")
        print(f"  API/health: {backend_base}/health")
        print("  Rotinas active serão executadas pelo scheduler do backend.")
        if not args.no_browser:
            threading.Thread(target=lambda: webbrowser.open(frontend_base), daemon=True).start()

        while True:
            time.sleep(0.5)
            for name, proc, url in (("backend", backend_proc, f"{backend_base}/health"), ("frontend", frontend_proc, frontend_base)):
                if proc is None or proc.poll() is None:
                    continue
                if args.no_restart or restart_counts[name] >= max(0, args.restart_limit):
                    raise RuntimeError(f"{name} encerrou inesperadamente (código {proc.returncode}).")
                restart_counts[name] += 1
                print(f"[AVISO] {name} caiu; reiniciando ({restart_counts[name]}/{args.restart_limit})...")
                if name == "backend":
                    backend_proc = _popen([
                        sys.executable, "-m", "uvicorn", "--app-dir", "src", "waddle.api.server:app",
                        "--host", args.backend_host, "--port", str(args.backend_port),
                    ], cwd=PROJECT_ROOT, env=env)
                    _wait_service("API FastAPI", url, backend_proc, args.readiness_timeout)
                else:
                    if not npm_path:
                        raise RuntimeError("npm não foi encontrado para reiniciar a interface.")
                    npm_args = ["run", "preview" if args.production else "dev", "--", "--host", args.frontend_host, "--port", str(args.frontend_port)]
                    shell = sys.platform.startswith("win") and npm_path.lower().endswith((".cmd", ".bat"))
                    frontend_proc = _popen([npm_path, *npm_args], cwd=WEB_DIR, env=env, shell=shell)
                    _wait_service("Interface Vite", url, frontend_proc, args.readiness_timeout)
    except (KeyboardInterrupt, SystemExit):
        return 0
    except Exception as exc:
        print(f"[ERRO] {exc}", file=sys.stderr)
        return 1
    finally:
        # Processes already running before this launcher are intentionally left alone.
        if not reused_frontend:
            kill_process_tree(frontend_proc)
        if not reused_backend:
            kill_process_tree(backend_proc)
        kill_process_tree(ollama_proc)


if __name__ == "__main__":
    raise SystemExit(main())
