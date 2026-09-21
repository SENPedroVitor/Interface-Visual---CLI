from __future__ import annotations

import json
import subprocess

from waddle.provider_settings import ProviderSettingsService
from waddle.providers import ProviderRegistry
from waddle.security.credentials import CredentialStore


class FakeSecretTool:
    def __init__(self) -> None:
        self.secrets: dict[str, str] = {}

    def __call__(self, command, *, input=None, text=True, capture_output=True, timeout=None, check=False):
        provider = command[-1]
        action = command[1]
        if action == "store":
            self.secrets[provider] = input or ""
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        if action == "lookup":
            secret = self.secrets.get(provider)
            return subprocess.CompletedProcess(command, 0 if secret else 1, stdout=secret or "", stderr="")
        if action == "clear":
            self.secrets.pop(provider, None)
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        return subprocess.CompletedProcess(command, 2, stdout="", stderr="unsupported")


def test_provider_settings_persist_selection_under_xdg_config(tmp_path, monkeypatch):
    monkeypatch.setenv("WADDLE_CONFIG_DIR", str(tmp_path / "config"))
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    registry = ProviderRegistry(platform="linux", env={"PATH": ""}, home=tmp_path / "home")
    store = CredentialStore(backend="memory")

    service = ProviderSettingsService(registry=registry, credential_store=store)
    state = service.select("codex", "gpt-4o-mini")

    assert state["selected_provider_id"] == "codex"
    assert state["selected_model_id"] == "gpt-4o-mini"
    settings_path = tmp_path / "config" / "providers" / "settings.json"
    assert json.loads(settings_path.read_text(encoding="utf-8")) == {
        "selected_provider_id": "codex",
        "selected_models": {"codex": "gpt-4o-mini"},
    }

    restored = ProviderSettingsService(registry=registry, credential_store=store)
    restored_state = restored.get_state()

    assert restored_state["selected_provider_id"] == "codex"
    assert restored_state["selected_model_id"] == "gpt-4o-mini"


def test_provider_settings_saves_secret_through_secret_service_metadata_only(tmp_path, monkeypatch):
    monkeypatch.setenv("WADDLE_CONFIG_DIR", str(tmp_path / "config"))
    monkeypatch.setenv("WADDLE_DATA_DIR", str(tmp_path / "data"))
    fake_secret_tool = FakeSecretTool()
    metadata_path = tmp_path / "data" / "credentials.secretservice.json"
    registry = ProviderRegistry(platform="linux", env={"PATH": ""}, home=tmp_path / "home")
    store = CredentialStore(
        path=metadata_path,
        backend="secret-service",
        secret_tool="/usr/bin/secret-tool",
        command_runner=fake_secret_tool,
    )

    service = ProviderSettingsService(registry=registry, credential_store=store)
    public = service.save_credential("codex", "sk-native-secret", model_id="gpt-4o", name="Codex")

    assert public["configured"] is True
    assert "sk-native-secret" not in str(public)
    assert store.get_secret("codex") == "sk-native-secret"
    assert "sk-native-secret" not in metadata_path.read_text(encoding="utf-8")

    restored_store = CredentialStore(
        path=metadata_path,
        backend="secret-service",
        secret_tool="/usr/bin/secret-tool",
        command_runner=fake_secret_tool,
    )
    restored = ProviderSettingsService(registry=registry, credential_store=restored_store)
    state = restored.get_state()

    assert state["selected_provider_id"] == "codex"
    assert state["selected_model_id"] == "gpt-4o"
    assert [provider for provider in state["providers"] if provider["id"] == "codex"][0]["credential_configured"] is True
