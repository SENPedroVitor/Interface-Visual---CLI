"""Shared provider settings persistence for native and server surfaces."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

from .core.os_layer import get_waddle_config_dir
from .providers import ProviderRegistry
from .security.credentials import CredentialStore, CredentialStoreError


class ProviderSettingsError(RuntimeError):
    """Raised when provider settings cannot be read or persisted."""


class ProviderSettingsService:
    """Compose ProviderRegistry, XDG config state, and protected credentials."""

    def __init__(
        self,
        *,
        registry: Optional[ProviderRegistry] = None,
        credential_store: Optional[CredentialStore] = None,
        config_dir: Optional[Path | str] = None,
        probe_local_models: bool = False,
    ) -> None:
        self.registry = registry or ProviderRegistry()
        self.credential_store = credential_store or CredentialStore()
        self.config_dir = Path(config_dir).expanduser() if config_dir else get_waddle_config_dir()
        self.settings_path = self.config_dir / "providers" / "settings.json"
        self.probe_local_models = probe_local_models

    def get_state(self) -> dict[str, Any]:
        settings = self._read_settings()
        providers = self.list_providers()
        selected_provider = self._selected_provider_id(settings, providers)
        selected_model = self._selected_model_id(settings, selected_provider)
        return {
            "selected_provider_id": selected_provider,
            "selected_model_id": selected_model,
            "providers": providers,
            "models": self.list_models(selected_provider),
        }

    def list_providers(self) -> list[dict[str, Any]]:
        settings = self._read_settings()
        selected_provider = str(settings.get("selected_provider_id") or "")
        selected_models = settings.get("selected_models") if isinstance(settings.get("selected_models"), dict) else {}
        credentials = {item["provider_id"]: item for item in self._list_credentials()}
        providers: list[dict[str, Any]] = []
        for item in self.registry.list_providers():
            provider_id = str(item.get("id") or "").lower()
            credential = credentials.get(provider_id, {})
            providers.append(
                {
                    **item,
                    "id": provider_id,
                    "configured": bool(credential.get("configured")) or provider_id == "ollama",
                    "credential_configured": bool(credential.get("configured")),
                    "masked_key": credential.get("masked_key"),
                    "selected": provider_id == selected_provider,
                    "selected_model_id": str(selected_models.get(provider_id) or credential.get("model") or ""),
                }
            )
        return providers

    def list_models(self, provider_id: str) -> list[dict[str, Any]]:
        provider = self._normalize_provider(provider_id)
        settings = self._read_settings()
        selected = self._selected_model_id(settings, provider)
        models: list[dict[str, Any]] = []
        for item in self.registry.list_provider_models(provider, probe_local=self.probe_local_models):
            model_id = str(item.get("id") or "")
            is_selected = model_id == selected or (not selected and bool(item.get("is_default")))
            models.append({**item, "id": model_id, "selected": is_selected})
        return models

    def select(self, provider_id: str, model_id: Optional[str] = None) -> dict[str, Any]:
        provider = self._normalize_provider(provider_id)
        model = self._normalize_model(model_id or self._default_model_id(provider))
        settings = self._read_settings()
        selected_models = settings.get("selected_models") if isinstance(settings.get("selected_models"), dict) else {}
        selected_models[provider] = model
        settings["selected_provider_id"] = provider
        settings["selected_models"] = selected_models
        self._write_settings(settings)
        self._sync_existing_credential_metadata(provider, model)
        return self.get_state()

    def save_credential(
        self,
        provider_id: str,
        api_key: str,
        *,
        model_id: Optional[str] = None,
        name: str = "",
        base_url: str = "",
    ) -> dict[str, Any]:
        provider = self._normalize_provider(provider_id)
        model = self._normalize_model(model_id or self._selected_model_id(self._read_settings(), provider) or self._default_model_id(provider))
        public = self.credential_store.set(provider, api_key, name=name or provider, model=model, base_url=base_url)
        self.select(provider, model)
        return public

    def delete_credential(self, provider_id: str) -> bool:
        return self.credential_store.delete(self._normalize_provider(provider_id))

    def _sync_existing_credential_metadata(self, provider: str, model: str) -> None:
        try:
            config = self.credential_store.get_config(provider)
        except CredentialStoreError:
            return
        secret = config.get("key") if isinstance(config, dict) else ""
        if not secret:
            return
        self.credential_store.set(
            provider,
            secret,
            name=config.get("name") or provider,
            model=model,
            base_url=config.get("base_url") or "",
        )

    def _selected_provider_id(self, settings: dict[str, Any], providers: list[dict[str, Any]]) -> str:
        selected = str(settings.get("selected_provider_id") or "").lower()
        provider_ids = {str(item.get("id") or "").lower() for item in providers}
        if selected and selected in provider_ids:
            return selected
        for preferred in ("ollama", "codex", "claude"):
            if preferred in provider_ids:
                return preferred
        return next(iter(provider_ids), "")

    def _selected_model_id(self, settings: dict[str, Any], provider: str) -> str:
        selected_models = settings.get("selected_models") if isinstance(settings.get("selected_models"), dict) else {}
        selected = str(selected_models.get(provider) or "")
        if selected:
            return selected
        try:
            config = self.credential_store.get_config(provider)
        except CredentialStoreError:
            return ""
        return str(config.get("model") or "") if isinstance(config, dict) else ""

    def _default_model_id(self, provider: str) -> str:
        for model in self.registry.list_provider_models(provider, probe_local=self.probe_local_models):
            if model.get("is_default"):
                return str(model.get("id") or "")
        models = self.registry.list_provider_models(provider, probe_local=self.probe_local_models)
        return str(models[0].get("id") or "") if models else ""

    def _list_credentials(self) -> list[dict[str, Any]]:
        try:
            return self.credential_store.list_public()
        except CredentialStoreError:
            return []

    def _read_settings(self) -> dict[str, Any]:
        if not self.settings_path.exists():
            return {}
        try:
            decoded = json.loads(self.settings_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ProviderSettingsError("Nao foi possivel abrir as configuracoes de provedores.") from exc
        return decoded if isinstance(decoded, dict) else {}

    def _write_settings(self, settings: dict[str, Any]) -> None:
        self.settings_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "selected_provider_id": str(settings.get("selected_provider_id") or ""),
            "selected_models": {
                str(provider): str(model)
                for provider, model in (settings.get("selected_models") or {}).items()
                if str(provider) and str(model)
            },
        }
        fd, temporary = tempfile.mkstemp(prefix=".settings-", suffix=".json.tmp", dir=str(self.settings_path.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            os.replace(temporary, self.settings_path)
        finally:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass

    @staticmethod
    def _normalize_provider(provider_id: str) -> str:
        provider = str(provider_id or "").strip().lower()
        if not provider:
            raise ValueError("Provedor invalido.")
        return provider

    @staticmethod
    def _normalize_model(model_id: str) -> str:
        model = str(model_id or "").strip()
        if not model:
            raise ValueError("Modelo invalido.")
        return model[:160]
