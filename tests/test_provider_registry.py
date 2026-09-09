import tempfile
import unittest
import os
from pathlib import Path

from waddle.providers import ProviderRegistry


class TestProviderRegistry(unittest.TestCase):
    def test_lists_core_provider_slots(self):
        providers = ProviderRegistry(ollama_path=Path("Z:/missing/ollama.exe")).list_providers()
        ids = {provider["id"] for provider in providers}

        self.assertEqual(ids, {"ollama", "codex", "claude"})

    def test_detects_portable_ollama_path_even_when_not_on_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_ollama = Path(tmp) / "ollama.exe"
            fake_ollama.write_text("", encoding="utf-8")

            ollama = ProviderRegistry(ollama_path=fake_ollama).list_providers()[0]

        self.assertEqual(ollama["id"], "ollama")
        self.assertTrue(ollama["installed"])
        self.assertEqual(ollama["path"], str(fake_ollama))

    def test_detects_latest_codex_binary_from_default_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            older = Path(tmp) / "old"
            newer = Path(tmp) / "new"
            older.mkdir()
            newer.mkdir()
            (older / "codex.exe").write_text("", encoding="utf-8")
            (newer / "codex.exe").write_text("", encoding="utf-8")
            os.utime(older / "codex.exe", (1, 1))
            os.utime(newer / "codex.exe", (2, 2))

            registry = ProviderRegistry()
            import waddle.providers as providers_module

            original = providers_module.DEFAULT_CODEX_ROOT
            try:
                providers_module.DEFAULT_CODEX_ROOT = Path(tmp)
                found = registry._find_codex()
            finally:
                providers_module.DEFAULT_CODEX_ROOT = original

        self.assertEqual(found, newer / "codex.exe")


if __name__ == "__main__":
    unittest.main()
