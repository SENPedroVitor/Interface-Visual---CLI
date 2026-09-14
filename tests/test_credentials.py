from __future__ import annotations

import asyncio
import unittest

from fastapi import HTTPException

import waddle.api.server as server
from waddle.security.credentials import CredentialStore


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
