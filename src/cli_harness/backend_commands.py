from __future__ import annotations

import shlex
from pathlib import Path

from .config import get_env_value


COMMAND_ENV_BY_BACKEND = {
    "codex": "CODEX_CMD",
    "qwen": "QWEN_CMD",
}

DEFAULT_COMMAND_BY_BACKEND = {
    "codex": "codex --no-alt-screen",
    "qwen": "qwen --screen-reader",
}


def _find_executable_index(parts: list[str]) -> int:
    if not parts:
        return -1
    if parts[0] != "env":
        return 0

    idx = 1
    while idx < len(parts) and "=" in parts[idx] and not parts[idx].startswith("-"):
        idx += 1
    return idx if idx < len(parts) else -1


def _ensure_flag(parts: list[str], start_idx: int, flag: str) -> None:
    if flag in parts[start_idx + 1 :]:
        return
    parts.append(flag)


def _apply_recommended_flags(backend: str, command: str) -> str:
    try:
        parts = shlex.split(command)
    except ValueError:
        return command

    cmd_idx = _find_executable_index(parts)
    if cmd_idx < 0:
        return command

    executable = Path(parts[cmd_idx]).name
    if backend == "codex" and executable == "codex":
        _ensure_flag(parts, cmd_idx, "--no-alt-screen")
    elif backend == "qwen" and executable == "qwen":
        _ensure_flag(parts, cmd_idx, "--screen-reader")

    return shlex.join(parts)


def resolve_backend_command(backend: str, override: str | None = None) -> str:
    if override:
        return _apply_recommended_flags(backend, override)

    env_name = COMMAND_ENV_BY_BACKEND.get(backend, f"{backend.upper()}_CMD")
    default_command = DEFAULT_COMMAND_BY_BACKEND.get(backend, backend)
    configured = get_env_value(env_name, default_command) or default_command
    return _apply_recommended_flags(backend, configured)
