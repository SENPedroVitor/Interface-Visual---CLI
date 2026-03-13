import os
import shlex
from typing import Any

from ..repl import run_repl_session


class ReplBackend:
    """Backend adapter for interactive CLI tools (Codex, Qwen, etc.)."""

    is_repl = True

    def __init__(self, name: str, command_env: str, default_cmd: str):
        self.name = name
        self.command_env = command_env
        self.default_cmd = default_cmd

    def list_models(self) -> list[str]:
        return []

    def send_message(self, message: str, model: str | None = None) -> dict[str, Any]:
        raise NotImplementedError("REPL backends use interactive chat only.")

    def run_repl(self) -> int:
        cmd_value = os.getenv(self.command_env, self.default_cmd)
        command = shlex.split(cmd_value)
        return run_repl_session(command, backend_name=self.name, command_label=cmd_value)
