from __future__ import annotations

import asyncio
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

import waddle.api.server as server
from waddle.security.credentials import CredentialStore, CredentialStoreError


class FakeSecretTool:
    def __init__(self):
        self.secrets = {}

    def __call__(self, command, *, input=None, text=True, capture_output=True, timeout=None, check=False):
        provider = command[-1]
        action = command[1]
        if action == "store":
            self.secrets[provider] = input
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        if action == "lookup":
            secret = self.secrets.get(provider)
            return subprocess.CompletedProcess(command, 0 if secret else 1, stdout=secret or "", stderr="")
        if action == "clear":
            self.secrets.pop(provider, None)
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        return subprocess.CompletedProcess(command, 2, stdout="", stderr="unsupported")


class TestCredentialStore(unittest.TestCase):
    def test_memory_store_masks_and_replaces_without_exposing_secret(self):
        store = CredentialStore(backend="memory")

        stored = store.set("openai", "sk-test-secret-1234")

        self.assertEqual(stored["provider_id"], "openai")
        self.assertTrue(stored["configured"])
        self.assertNotIn("sk-test-secret-1234", str(stored))
        self.assertNotEqual(stored["masked_key"], "sk-test-secret-1234")
        self.assertEqual(store.get_secret("openai"), "sk-test-secret-1234")
        self.assertEqual(len(store.list_public()), 1)

        store.set("openai", "replacement")
        self.assertEqual(store.get_secret("openai"), "replacement")
        self.assertEqual(len(store.list_public()), 1)

    def test_memory_store_delete_and_reject_invalid_provider(self):
        store = CredentialStore(backend="memory")
        with self.assertRaises(ValueError):
            store.set("", "secret")
        with self.assertRaises(ValueError):
            store.set("provider", "   ")

        store.set("claude", "secret")
        self.assertTrue(store.delete("claude"))
        self.assertFalse(store.delete("claude"))
        self.assertIsNone(store.get_secret("claude"))

    def test_secret_service_backend_stores_secret_outside_metadata(self):
        fake_secret_tool = FakeSecretTool()
        with self.subTest("write and reload"):
            with tempfile.TemporaryDirectory() as tmp:
                metadata_path = Path(tmp) / "credentials.json"
                store = CredentialStore(
                    path=metadata_path,
                    backend="secret-service",
                    secret_tool="/usr/bin/secret-tool",
                    command_runner=fake_secret_tool,
                )

                public = store.set("openai", "sk-secret-linux", name="OpenAI", model="gpt-4o")

                self.assertEqual(public["masked_key"], "sk-********inux")
                self.assertEqual(store.get_secret("openai"), "sk-secret-linux")
                metadata = metadata_path.read_text(encoding="utf-8")
                self.assertNotIn("sk-secret-linux", metadata)
                self.assertIn("gpt-4o", metadata)

                reloaded = CredentialStore(
                    path=metadata_path,
                    backend="secret-service",
                    secret_tool="/usr/bin/secret-tool",
                    command_runner=fake_secret_tool,
                )
                self.assertEqual(reloaded.get_secret("openai"), "sk-secret-linux")
                self.assertEqual(reloaded.list_public()[0]["name"], "OpenAI")

                self.assertTrue(reloaded.delete("openai"))
                self.assertIsNone(reloaded.get_secret("openai"))
                self.assertNotIn("openai", fake_secret_tool.secrets)

    def test_secret_service_backend_requires_secret_tool(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("waddle.security.credentials.shutil.which", return_value=None):
                with self.assertRaises(CredentialStoreError):
                    CredentialStore(path=Path(tmp) / "credentials.json", backend="secret-service")


class TestCredentialEndpoints(unittest.TestCase):
    def test_endpoints_only_return_masked_state(self):
        async def scenario() -> None:
            original = server.credential_store
            server.credential_store = CredentialStore(backend="memory")
            try:
                saved = await server.save_credential(
                    "openai",
                    server.CredentialRequest(
                        api_key="sk-live-secret", name="OpenAI pessoal", model="gpt-4o-mini", base_url="https://api.openai.com/v1"
                    ),
                )
                self.assertTrue(saved["configured"])
                self.assertNotIn("sk-live-secret", str(saved))
                self.assertEqual(saved["name"], "OpenAI pessoal")
                self.assertEqual(saved["model"], "gpt-4o-mini")

                listed = await server.list_credentials()
                self.assertEqual(listed[0]["provider_id"], "openai")
                self.assertNotIn("sk-live-secret", str(listed))
                self.assertEqual(server.credential_store.get_secret("openai"), "sk-live-secret")
                tested = await server.test_credential("openai")
                self.assertTrue(tested["ok"])

                removed = await server.delete_credential("openai")
                self.assertEqual(removed, {"provider_id": "openai", "configured": False})
            finally:
                server.credential_store = original

        asyncio.run(scenario())

    def test_endpoint_maps_storage_failure_to_service_unavailable(self):
        class BrokenStore:
            def set(self, _provider_id, _api_key, **_metadata):
                raise RuntimeError("storage unavailable")

        async def scenario() -> None:
            original = server.credential_store
            server.credential_store = BrokenStore()
            try:
                with self.assertRaises(HTTPException) as raised:
                    await server.save_credential("openai", server.CredentialRequest(api_key="secret"))
                self.assertEqual(raised.exception.status_code, 503)
            finally:
                server.credential_store = original

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
