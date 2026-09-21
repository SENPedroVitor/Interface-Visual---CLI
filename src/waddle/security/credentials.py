"""Protected storage for provider API keys.

On Windows, secrets are encrypted with the user-scoped DPAPI before being
written to Waddle's data directory. On Linux, the default store uses the
freedesktop Secret Service through ``secret-tool`` when it is available.
Tests may explicitly use the in-memory backend
(``CredentialStore(backend="memory")``); no plaintext fallback file is ever
created.
"""
from __future__ import annotations

import base64
import ctypes
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional, Protocol

from ..core.os_layer import get_platform_name, get_waddle_data_dir


class CredentialStoreError(RuntimeError):
    """Raised when protected credential storage cannot be read or written."""


_PROVIDER_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
CommandRunner = Callable[..., subprocess.CompletedProcess[str]]


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


class _CredentialBackend(Protocol):
    name: str

    def read(self) -> dict[str, dict[str, str]]:
        ...

    def write(self, records: dict[str, dict[str, str]]) -> None:
        ...


class _UnavailableBackend:
    name = "unavailable"

    def __init__(self, reason: str) -> None:
        self.reason = reason

    def read(self) -> dict[str, dict[str, str]]:
        raise CredentialStoreError(self.reason)

    def write(self, records: dict[str, dict[str, str]]) -> None:
        raise CredentialStoreError(self.reason)


class _MemoryBackend:
    name = "memory"

    def __init__(self) -> None:
        self.records: dict[str, dict[str, str]] = {}

    def read(self) -> dict[str, dict[str, str]]:
        return {provider: dict(record) for provider, record in self.records.items()}

    def write(self, records: dict[str, dict[str, str]]) -> None:
        self.records = {provider: dict(record) for provider, record in records.items()}


class _DpapiFileBackend:
    name = "dpapi"

    def __init__(self, path: Path) -> None:
        if os.name != "nt":
            raise CredentialStoreError("DPAPI está disponível apenas no Windows.")
        self.path = path

    def read(self) -> dict[str, dict[str, str]]:
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

    def write(self, records: dict[str, dict[str, str]]) -> None:
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


class _SecretServiceBackend:
    name = "secret-service"
    timeout_seconds = 5.0

    def __init__(
        self,
        metadata_path: Path,
        *,
        executable: Optional[str] = None,
        runner: Optional[CommandRunner] = None,
    ) -> None:
        self.metadata_path = metadata_path
        self.executable = executable or shutil.which("secret-tool")
        if not self.executable:
            raise CredentialStoreError("Secret Service indisponível; instale libsecret/secret-tool para salvar credenciais.")
        self.runner = runner or subprocess.run

    def read(self) -> dict[str, dict[str, str]]:
        metadata = self._read_metadata()
        records: dict[str, dict[str, str]] = {}
        for provider, record in metadata.items():
            secret = self._lookup(provider)
            merged = dict(record)
            merged["key"] = secret or ""
            records[provider] = merged
        return records

    def write(self, records: dict[str, dict[str, str]]) -> None:
        existing = set(self._read_metadata())
        current = set(records)
        for provider in sorted(existing - current):
            self._clear(provider)
        for provider, record in records.items():
            secret = record.get("key", "")
            if secret:
                self._store(provider, secret)
            else:
                self._clear(provider)
        self._write_metadata(records)

    def _read_metadata(self) -> dict[str, dict[str, str]]:
        if not self.metadata_path.exists():
            return {}
        try:
            decoded = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CredentialStoreError("Não foi possível abrir os metadados de credenciais.") from exc
        if not isinstance(decoded, dict):
            return {}
        records: dict[str, dict[str, str]] = {}
        for provider, record in decoded.items():
            if isinstance(provider, str) and isinstance(record, dict):
                clean = {str(key): str(value) for key, value in record.items() if key != "key"}
                records[provider] = clean
        return records

    def _write_metadata(self, records: dict[str, dict[str, str]]) -> None:
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        public_records = {
            provider: {key: value for key, value in record.items() if key != "key"}
            for provider, record in records.items()
        }
        fd, temporary = tempfile.mkstemp(prefix=".credentials-", suffix=".json.tmp", dir=str(self.metadata_path.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(public_records, handle, ensure_ascii=False, separators=(",", ":"))
            os.replace(temporary, self.metadata_path)
        finally:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass

    def _lookup(self, provider: str) -> str:
        result = self._run(["lookup", "application", "waddle", "provider", provider])
        return (result.stdout or "").strip() if result.returncode == 0 else ""

    def _store(self, provider: str, secret: str) -> None:
        result = self._run(
            ["store", "--label", f"Waddle {provider} API key", "application", "waddle", "provider", provider],
            input=secret,
        )
        if result.returncode != 0:
            raise CredentialStoreError("Secret Service recusou salvar a credencial.")

    def _clear(self, provider: str) -> None:
        result = self._run(["clear", "application", "waddle", "provider", provider])
        if result.returncode not in {0, 1}:
            raise CredentialStoreError("Secret Service recusou remover a credencial.")

    def _run(self, arguments: list[str], *, input: Optional[str] = None) -> subprocess.CompletedProcess[str]:
        try:
            return self.runner(
                [self.executable, *arguments],
                input=input,
                text=True,
                capture_output=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise CredentialStoreError("Secret Service indisponível para a operação de credenciais.") from exc


class CredentialStore:
    """Store API keys without exposing or persisting them in plaintext."""

    def __init__(
        self,
        path: Optional[Path | str] = None,
        *,
        backend: str = "auto",
        command_runner: Optional[CommandRunner] = None,
        secret_tool: Optional[str] = None,
    ) -> None:
        if backend not in {"auto", "dpapi", "memory", "secret-service", "secretservice", "unavailable"}:
            raise ValueError("Backend de credenciais inválido.")
        normalized = "secret-service" if backend == "secretservice" else backend
        self.path = Path(path) if path else get_waddle_data_dir() / "credentials.dpapi"
        self.backend = self._resolve_backend_name(normalized, secret_tool=secret_tool)
        self._backend = self._build_backend(command_runner=command_runner, secret_tool=secret_tool)

    @staticmethod
    def _resolve_backend_name(backend: str, *, secret_tool: Optional[str]) -> str:
        if backend != "auto":
            return backend
        platform = get_platform_name()
        if platform == "windows":
            return "dpapi"
        if platform == "linux" and (secret_tool or shutil.which("secret-tool")):
            return "secret-service"
        return "unavailable"

    def _build_backend(
        self,
        *,
        command_runner: Optional[CommandRunner],
        secret_tool: Optional[str],
    ) -> _CredentialBackend:
        if self.backend == "memory":
            return _MemoryBackend()
        if self.backend == "dpapi":
            return _DpapiFileBackend(self.path)
        if self.backend == "secret-service":
            metadata_path = self.path
            if metadata_path.name == "credentials.dpapi":
                metadata_path = metadata_path.with_name("credentials.secretservice.json")
            return _SecretServiceBackend(metadata_path, executable=secret_tool, runner=command_runner)
        return _UnavailableBackend(
            "Armazenamento protegido indisponível; use Windows DPAPI, Linux Secret Service ou backend de memória apenas em testes."
        )

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

    def _read(self) -> dict[str, dict[str, str]]:
        return self._backend.read()

    def _write(self, records: dict[str, dict[str, str]]) -> None:
        self._backend.write(records)

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
