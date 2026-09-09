"""Local AI/code-agent provider discovery for Waddle Agent OS."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess
from typing import Optional


DEFAULT_OLLAMA_PATH = Path.home() / "AppData" / "Local" / "Programs" / "OllamaPortable" / "ollama.exe"
DEFAULT_CLAUDE_PATH = Path.home() / ".local" / "bin" / "claude.exe"
DEFAULT_CODEX_ROOT = Path.home() / "AppData" / "Local" / "OpenAI" / "Codex" / "bin"


@dataclass
class ProviderStatus:
    id: str
    name: str
    kind: str
    installed: bool
    available: bool
    command: str
    path: Optional[str] = None
    version: Optional[str] = None
    detail: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "installed": self.installed,
            "available": self.available,
            "command": self.command,
            "path": self.path,
            "version": self.version,
            "detail": self.detail,
        }


class ProviderRegistry:
    """Detect local providers without mutating the machine."""

    def __init__(self, ollama_path: Optional[Path | str] = None) -> None:
        self.ollama_path = Path(ollama_path) if ollama_path else DEFAULT_OLLAMA_PATH

    def list_providers(self) -> list[dict[str, object]]:
        return [
            self._detect_ollama().to_dict(),
            self._detect_cli("codex", "Codex", "code-agent", "codex --version", self._find_codex()).to_dict(),
            self._detect_cli("claude", "Claude Code", "code-agent", "claude --version", DEFAULT_CLAUDE_PATH).to_dict(),
        ]

    def _detect_ollama(self) -> ProviderStatus:
        resolved = shutil.which("ollama")
        if not resolved and self.ollama_path.exists():
            resolved = str(self.ollama_path)

        if not resolved:
            return ProviderStatus(
                id="ollama",
                name="Ollama",
                kind="local-llm",
                installed=False,
                available=False,
                command="ollama --version",
                detail="Ollama não foi encontrado no PATH nem no caminho portátil padrão.",
            )

        version = self._run_version([resolved, "--version"])
        server_available = self._ollama_server_available(resolved)
        return ProviderStatus(
            id="ollama",
            name="Ollama",
            kind="local-llm",
            installed=True,
            available=server_available,
            command="ollama serve",
            path=resolved,
            version=version,
            detail="Servidor local ativo em 127.0.0.1:11434." if server_available else "CLI encontrada; servidor local não respondeu.",
        )

    def _detect_cli(
        self,
        executable: str,
        name: str,
        kind: str,
        command: str,
        fallback_path: Optional[Path] = None,
    ) -> ProviderStatus:
        resolved = shutil.which(executable)
        if not resolved and fallback_path and fallback_path.exists():
            resolved = str(fallback_path)
        if not resolved:
            return ProviderStatus(
                id=executable,
                name=name,
                kind=kind,
                installed=False,
                available=False,
                command=command,
                detail=f"{name} não foi encontrado no PATH.",
            )
        version = self._run_version([resolved, "--version"])
        return ProviderStatus(
            id=executable,
            name=name,
            kind=kind,
            installed=True,
            available=True,
            command=command,
            path=resolved,
            version=version,
            detail=f"{name} CLI pronta para receber tarefas locais.",
        )

    def _find_codex(self) -> Optional[Path]:
        if not DEFAULT_CODEX_ROOT.exists():
            return None
        matches = sorted(DEFAULT_CODEX_ROOT.glob("*/codex.exe"), key=lambda path: path.stat().st_mtime, reverse=True)
        return matches[0] if matches else None

    def _run_version(self, command: list[str]) -> Optional[str]:
        try:
            result = subprocess.run(command, text=True, capture_output=True, timeout=8, check=False)
        except Exception:
            return None
        output = (result.stdout or result.stderr).strip()
        return output.splitlines()[0] if output else None

    def _ollama_server_available(self, executable: str) -> bool:
        try:
            result = subprocess.run(
                [executable, "list"],
                text=True,
                capture_output=True,
                timeout=8,
                check=False,
            )
        except Exception:
            return False
        return result.returncode == 0 and "NAME" in result.stdout
