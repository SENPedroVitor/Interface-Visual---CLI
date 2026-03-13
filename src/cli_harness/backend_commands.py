from __future__ import annotations

import os


COMMAND_ENV_BY_BACKEND = {
    "codex": "CODEX_CMD",
    "qwen": "QWEN_CMD",
}

DEFAULT_COMMAND_BY_BACKEND = {
    "codex": "codex",
    "qwen": "qwen",
}


def resolve_backend_command(backend: str, override: str | None = None) -> str:
    if override:
        return override

    env_name = COMMAND_ENV_BY_BACKEND.get(backend, f"{backend.upper()}_CMD")
    default_command = DEFAULT_COMMAND_BY_BACKEND.get(backend, backend)
    return os.getenv(env_name, default_command)
