"""Cross-platform launcher for Waddle Agent OS (Windows and Linux).

Automatically starts both the Backend API (FastAPI / Uvicorn) and the Web UI
(React / Vite), manages processes together, and opens the browser.
"""
import os
import sys
import time
import shutil
import signal
import subprocess
import threading
import webbrowser
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
WEB_DIR = PROJECT_ROOT / "web"


def kill_process_tree(proc: subprocess.Popen | None):
    if proc is None or proc.poll() is not None:
        return
    try:
        if sys.platform.startswith("win"):
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            proc.terminate()
            proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def main():
    print("=" * 64)
    print("  [WADDLE] AGENT OS — Plataforma Multiagente Autonoma Local")
    print("=" * 64)

    # 1. Prepare Environment
    env = dict(os.environ)
    pythonpath = str(SRC_DIR)
    if "PYTHONPATH" in env:
        pythonpath = f"{pythonpath}{os.pathsep}{env['PYTHONPATH']}"
    env["PYTHONPATH"] = pythonpath

    # Check npm availability for frontend
    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_path and sys.platform.startswith("win"):
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
            cand_npm = candidate_dir / "npm.cmd"
            if cand_npm.exists():
                npm_path = str(cand_npm)
                node_dir_str = str(candidate_dir)
                if node_dir_str not in env.get("PATH", ""):
                    env["PATH"] = f"{node_dir_str}{os.pathsep}{env.get('PATH', '')}"
                break

    has_web = WEB_DIR.exists() and npm_path is not None

    backend_proc = None
    frontend_proc = None

    def cleanup_all():
        print("\n\n[!] Encerrando Waddle Agent OS...")
        if frontend_proc:
            print("   -> Parando Frontend (Vite)...")
            kill_process_tree(frontend_proc)
        if backend_proc:
            print("   -> Parando Backend (FastAPI / Uvicorn)...")
            kill_process_tree(backend_proc)
        print("[OK] Todos os servicos foram finalizados com sucesso.\n")

    # Handle signal interrupts
    def signal_handler(sig, frame):
        cleanup_all()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, signal_handler)

    try:
        # 2. Start Backend API
        print("\n[1/2] [*] Iniciando Backend API & WebSocket (Porta 8000)...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "--app-dir",
            "src",
            "waddle.api.server:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            "--reload",
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(PROJECT_ROOT),
            env=env,
        )

        # Give backend a moment to boot
        time.sleep(1.2)

        target_url = "http://127.0.0.1:8000"

        # 3. Start Frontend (React + Vite)
        if has_web:
            print("[2/2] [*] Iniciando Frontend Web UI (Porta 5173 com Hot-Reload)...")
            frontend_cmd = [npm_path, "run", "dev"]
            frontend_proc = subprocess.Popen(
                frontend_cmd,
                cwd=str(WEB_DIR),
                shell=sys.platform.startswith("win"),
                env=env,
            )
            target_url = "http://localhost:5173"
        else:
            print("[2/2] [i] Frontend embutido no Backend via build estatico (Porta 8000)...")

        print("\n" + "─" * 64)
        print(f"  [*] Waddle Agent OS rodando!")
        print(f"  -> Interface Web:  {target_url}")
        print(f"  -> API & Swagger:  http://127.0.0.1:8000/docs")
        print("  -> Pressione Ctrl+C para parar ambos os servicos a qualquer momento.")
        print("─" * 64 + "\n")

        # Open browser in a separate thread
        def open_browser():
            time.sleep(2.0)
            webbrowser.open(target_url)

        threading.Thread(target=open_browser, daemon=True).start()

        # Monitor processes
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print("[!] Backend foi encerrado inesperadamente.")
                break
            if frontend_proc and frontend_proc.poll() is not None:
                print("[!] Frontend foi encerrado inesperadamente.")
                break

    except KeyboardInterrupt:
        pass
    finally:
        cleanup_all()


if __name__ == "__main__":
    main()
