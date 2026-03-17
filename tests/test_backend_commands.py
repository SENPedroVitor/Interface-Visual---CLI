from __future__ import annotations

from cli_harness.backend_commands import resolve_backend_command


def test_codex_default_includes_recommended_flags(monkeypatch) -> None:
    monkeypatch.delenv("CODEX_CMD", raising=False)
    command = resolve_backend_command("codex")
    assert "--no-alt-screen" in command


def test_qwen_default_includes_screen_reader(monkeypatch) -> None:
    monkeypatch.delenv("QWEN_CMD", raising=False)
    command = resolve_backend_command("qwen")
    assert "--screen-reader" in command


def test_env_prefixed_command_keeps_env_and_appends_codex_flags(monkeypatch) -> None:
    monkeypatch.setenv("CODEX_CMD", "env TMPDIR=/tmp codex")
    command = resolve_backend_command("codex")
    assert command.startswith("env TMPDIR=/tmp codex")
    assert "--no-alt-screen" in command
