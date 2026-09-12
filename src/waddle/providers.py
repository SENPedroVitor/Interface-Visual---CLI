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
        resolved = str(self.ollama_path) if self.ollama_path.exists() else shutil.which("ollama")

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

    def list_provider_models(self, provider_id: str) -> list[dict[str, Any]]:
        pid = provider_id.lower()
        if pid == "ollama":
            models = []
            try:
                import urllib.request
                import json
                req = urllib.request.Request("http://127.0.0.1:11434/api/tags", headers={"User-Agent": "Waddle"})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    for m in data.get("models", []):
                        m_name = m.get("name", "")
                        details = m.get("details", {})
                        param_size = details.get("parameter_size", "")
                        models.append({
                            "id": m_name,
                            "name": m_name,
                            "tag": param_size or "Local",
                            "description": f"Modelo local ({details.get('family', 'ollama')})",
                            "is_default": len(models) == 0,
                            "size_bytes": m.get("size", 0),
                        })
            except Exception:
                pass
            if not models:
                models = [
                    {"id": "qwen2.5:0.5b", "name": "Qwen 2.5 (0.5B)", "tag": "Fast", "description": "Ultraleve para CPU local", "is_default": True},
                    {"id": "llama3.2:1b", "name": "Llama 3.2 (1B)", "tag": "Compact", "description": "Rápido e eficiente", "is_default": False},
                    {"id": "llama3.2:3b", "name": "Llama 3.2 (3B)", "tag": "Balanced", "description": "Excelente precisão local", "is_default": False},
                    {"id": "deepseek-r1:7b", "name": "DeepSeek R1 (7B)", "tag": "Reasoning", "description": "Raciocínio analítico avançado", "is_default": False},
                    {"id": "mistral:7b", "name": "Mistral (7B)", "tag": "Standard", "description": "Potente para código e tarefas", "is_default": False},
                ]
            return models
        elif pid == "claude":
            return [
                {"id": "claude-sonnet-5", "name": "Claude Sonnet 5", "tag": "Default", "description": "Modelo de referência para codificação e raciocínio", "is_default": True},
                {"id": "claude-fable-5.1", "name": "Claude Fable 5.1", "tag": "Creative", "description": "Criatividade e análise textual aprofundada", "is_default": False},
                {"id": "claude-fable-5", "name": "Claude Fable 5", "tag": "Stable", "description": "Versão estável para fluxos longos", "is_default": False},
                {"id": "claude-opus-5", "name": "Claude Opus 5", "tag": "Heavy", "description": "Máxima capacidade cognitiva para arquiteturas complexas", "is_default": False},
                {"id": "claude-haiku-4.5", "name": "Claude Haiku 4.5", "tag": "Fast", "description": "Respostas instantâneas e baixo consumo", "is_default": False},
            ]
        elif pid in {"codex", "openai"}:
            return [
                {"id": "gpt-4o", "name": "GPT-4o", "tag": "Default", "description": "Modelo multimodal veloz e inteligente", "is_default": True},
                {"id": "gpt-4o-mini", "name": "GPT-4o mini", "tag": "Fast", "description": "Econômico e ágil", "is_default": False},
                {"id": "o1", "name": "OpenAI o1", "tag": "Reasoning", "description": "Cadeia de pensamento profunda", "is_default": False},
                {"id": "o3-mini", "name": "OpenAI o3-mini", "tag": "Reasoning", "description": "Raciocínio rápido para código e matemática", "is_default": False},
            ]
        elif pid == "gemini":
            return [
                {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "tag": "Default", "description": "Velocidade extrema e janela de contexto estendida", "is_default": True},
                {"id": "gemini-2.0-pro", "name": "Gemini 2.0 Pro", "tag": "Powerful", "description": "Alta inteligência e raciocínio complexo", "is_default": False},
                {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "tag": "Fast", "description": "Versátil para tarefas cotidianas", "is_default": False},
            ]
        return [
            {"id": "default", "name": f"{provider_id.title()} Default", "tag": "Default", "description": "Modelo padrão do provedor", "is_default": True}
        ]
