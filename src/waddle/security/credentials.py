"""Protected storage for provider API keys.

On Windows, secrets are encrypted with the user-scoped DPAPI before being
written to Waddle's data directory.  Tests may explicitly use the in-memory
backend (``CredentialStore(backend="memory")``); no plaintext fallback file
is ever created.  On unsupported platforms the default store is unavailable
until an explicit backend is selected.
"""
from __future__ import annotations

import base64
import ctypes
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from ..core.os_layer import get_waddle_data_dir


class CredentialStoreError(RuntimeError):
    """Raised when protected credential storage cannot be read or written."""


_PROVIDER_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_uint32), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _dpapi_transform(payload: bytes, *, protect: bool) -> bytes:
    if os.name != "nt":
        raise CredentialStoreError("DPAPI está disponível apenas no Windows.")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    source = ctypes.create_string_buffer(payload)
    source_blob = _DataBlob(len(payload), ctypes.cast(source, ctypes.POINTER(ctypes.c_byte)))
    destination_blob = _DataBlob()
    function = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    function.argtypes = [
        ctypes.POINTER(_DataBlob),
        ctypes.c_wchar_p,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.POINTER(_DataBlob),
    ]
    function.restype = ctypes.c_bool
    if not function(
        ctypes.byref(source_blob),
        "Waddle credentials" if protect else None,
        None,
        None,
        None,
        0,
        ctypes.byref(destination_blob),
    ):
        raise CredentialStoreError("O Windows DPAPI recusou a operação de credenciais.")
    try:
        return ctypes.string_at(destination_blob.pbData, destination_blob.cbData)
    finally:
        kernel32.LocalFree(destination_blob.pbData)


class CredentialStore:
    """Store API keys without exposing or persisting them in plaintext."""

    def __init__(self, path: Optional[Path | str] = None, *, backend: str = "auto") -> None:
        if backend not in {"auto", "dpapi", "memory", "unavailable"}:
            raise ValueError("Backend de credenciais inválido.")
        self.backend = "dpapi" if backend == "auto" and os.name == "nt" else backend
        if backend == "auto" and os.name != "nt":
            self.backend = "unavailable"
        if self.backend == "dpapi" and os.name != "nt":
            raise CredentialStoreError("DPAPI está disponível apenas no Windows.")
        self.path = Path(path) if path else get_waddle_data_dir() / "credentials.dpapi"
        self._memory: dict[str, dict[str, str]] = {}

    @staticmethod
    def _validate_provider_id(provider_id: str) -> str:
        value = str(provider_id or "").strip()
        if not _PROVIDER_ID.fullmatch(value):
            raise ValueError("Identificador do provedor inválido.")
        return value.lower()

    @staticmethod
    def _validate_secret(api_key: str) -> str:
        value = str(api_key or "")
        if not value.strip():
            raise ValueError("A API key não pode ficar vazia.")
        if len(value) > 4096:
            raise ValueError("A API key excede o limite permitido.")
        return value

    @staticmethod
    def mask(api_key: str) -> str:
        if len(api_key) <= 4:
            return "*" * len(api_key)
        if len(api_key) <= 8:
            return "****" + api_key[-2:]
        return f"{api_key[:3]}{'*' * min(8, max(4, len(api_key) - 7))}{api_key[-4:]}"

    def _ensure_available(self) -> None:
        if self.backend == "unavailable":
            raise CredentialStoreError(
                "Armazenamento protegido indisponível; use Windows DPAPI ou backend de memória apenas em testes."
            )

    def _read(self) -> dict[str, dict[str, str]]:
        self._ensure_available()
        if self.backend == "memory":
            return dict(self._memory)
        if not self.path.exists():
            return {}
        try:
            encrypted = base64.b64decode(self.path.read_bytes(), validate=True)
            decoded = json.loads(_dpapi_transform(encrypted, protect=False).decode("utf-8"))
            return decoded if isinstance(decoded, dict) else {}
        except Exception as exc:
            if isinstance(exc, CredentialStoreError):
                raise
            raise CredentialStoreError("Não foi possível abrir o armazenamento protegido.") from exc

    def _write(self, records: dict[str, dict[str, str]]) -> None:
        self._ensure_available()
        if self.backend == "memory":
            self._memory = dict(records)
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        plaintext = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        encrypted = base64.b64encode(_dpapi_transform(plaintext, protect=True))
        fd, temporary = tempfile.mkstemp(prefix=".credentials-", suffix=".tmp", dir=str(self.path.parent))
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(encrypted)
            os.replace(temporary, self.path)
        finally:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass

    def set(
        self,
        provider_id: str,
        api_key: str,
        *,
        name: str = "",
        model: str = "",
        base_url: str = "",
    ) -> dict[str, Any]:
        provider = self._validate_provider_id(provider_id)
        secret = str(api_key or "")
        if not secret.strip() and provider != "ollama":
            raise ValueError("A API key não pode ficar vazia para este provedor.")
        if len(secret) > 4096:
            raise ValueError("A API key excede o limite permitido.")
        records = self._read()
        previous = records.get(provider) if isinstance(records.get(provider), dict) else {}
        records[provider] = {
            "key": secret,
            "name": str(name or previous.get("name") or provider)[:60],
            "model": str(model or previous.get("model") or "")[:160],
            "base_url": str(base_url or previous.get("base_url") or "")[:500],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._write(records)
        return self._public(provider, records[provider])

    def get_secret(self, provider_id: str) -> Optional[str]:
        provider = self._validate_provider_id(provider_id)
        record = self._read().get(provider)
        value = record.get("key") if isinstance(record, dict) else None
        return value if isinstance(value, str) and value else None

    def get_config(self, provider_id: str) -> dict[str, str]:
        provider = self._validate_provider_id(provider_id)
        record = self._read().get(provider)
        return dict(record) if isinstance(record, dict) else {}

    def list_public(self) -> list[dict[str, Any]]:
        records = self._read()
        return [self._public(provider, record) for provider, record in sorted(records.items())]

    def delete(self, provider_id: str) -> bool:
        provider = self._validate_provider_id(provider_id)
        records = self._read()
        if provider not in records:
            return False
        del records[provider]
        self._write(records)
        return True

    def _public(self, provider: str, record: dict[str, str]) -> dict[str, Any]:
        secret = record.get("key", "")
        return {
            "id": provider,
            "provider_id": provider,
            "provider": provider,
            "name": record.get("name") or provider,
            "configured": bool(secret),
            "masked_key": self.mask(secret) if secret else None,
            "model": record.get("model") or None,
            "base_url": record.get("base_url") or None,
            "updated_at": record.get("updated_at"),
        }


_default_store: Optional[CredentialStore] = None


def get_default_credential_store() -> CredentialStore:
    global _default_store
    if _default_store is None:
        configured_backend = (os.getenv("WADDLE_CREDENTIAL_STORE") or "auto").strip().lower()
        _default_store = CredentialStore(backend=configured_backend)
    return _default_store
