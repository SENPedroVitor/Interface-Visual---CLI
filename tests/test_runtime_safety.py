from __future__ import annotations

import os

from cli_harness import config
from cli_harness.native_controller import markdown_to_html, split_command_parts


def test_set_env_value_updates_runtime_state(tmp_path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    monkeypatch.setattr(config, "ENV_PATH", env_file)
    monkeypatch.delenv("WADDLE_TEST_KEY", raising=False)

    config.set_env_value("WADDLE_TEST_KEY", "one")
    assert os.getenv("WADDLE_TEST_KEY") == "one"
    assert config.get_env_value("WADDLE_TEST_KEY") == "one"

    config.set_env_value("WADDLE_TEST_KEY", "two")
    assert os.getenv("WADDLE_TEST_KEY") == "two"
    assert config.get_env_value("WADDLE_TEST_KEY") == "two"


def test_split_command_parts_handles_invalid_values() -> None:
    assert split_command_parts("") is None
    assert split_command_parts("   ") is None
    assert split_command_parts('"') is None
    assert split_command_parts("codex --no-alt-screen") == ["codex", "--no-alt-screen"]


def test_markdown_code_block_not_double_escaped() -> None:
    rendered = markdown_to_html('```py\nprint("<tag>")\n```')
    assert "&amp;lt;" not in rendered
    assert "&lt;tag&gt;" in rendered
    assert "<br/></code>" not in rendered


def test_empty_obsidian_path_falls_back_to_default(tmp_path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    monkeypatch.setattr(config, "ENV_PATH", env_file)
    monkeypatch.delenv("OBSIDIAN_VAULT_PATH", raising=False)

    config.set_env_value("OBSIDIAN_VAULT_PATH", "")
    assert config.get_obsidian_vault_path() == config.DEFAULT_OBSIDIAN_VAULT_PATH
