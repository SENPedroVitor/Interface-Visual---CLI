import tempfile
import unittest
import os
from pathlib import Path
from unittest.mock import patch

from waddle.providers import ProviderRegistry


class TestProviderRegistry(unittest.TestCase):
    def test_lists_core_provider_slots(self):
        providers = ProviderRegistry(ollama_path=Path("Z:/missing/ollama.exe"), env={"PATH": ""}).list_providers()
        ids = {provider["id"] for provider in providers}

        self.assertEqual(ids, {"ollama", "codex", "claude"})

    def test_detects_portable_ollama_path_even_when_not_on_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_ollama = Path(tmp) / "ollama.exe"
            fake_ollama.write_text("", encoding="utf-8")

            ollama = ProviderRegistry(ollama_path=fake_ollama, env={"PATH": ""}).list_providers()[0]

        self.assertEqual(ollama["id"], "ollama")
        self.assertTrue(ollama["installed"])
        self.assertEqual(ollama["path"], str(fake_ollama))

    def test_detects_latest_codex_binary_from_default_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            codex_root = Path(tmp) / "OpenAI" / "Codex" / "bin"
            older = codex_root / "old"
            newer = codex_root / "new"
            older.mkdir(parents=True)
            newer.mkdir(parents=True)
            (older / "codex.exe").write_text("", encoding="utf-8")
            (newer / "codex.exe").write_text("", encoding="utf-8")
            os.utime(older / "codex.exe", (1, 1))
            os.utime(newer / "codex.exe", (2, 2))

            registry = ProviderRegistry(platform="windows", env={"PATH": "", "LOCALAPPDATA": tmp})
            found = registry._find_codex()

        self.assertEqual(found, newer / "codex.exe")

    def test_detects_linux_provider_paths_from_xdg_and_home(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            xdg_bin = root / "xdg-data" / "npm" / "bin"
            home_bin = root / "home" / ".local" / "bin"
            xdg_bin.mkdir(parents=True)
            home_bin.mkdir(parents=True)
            codex = xdg_bin / "codex"
            claude = home_bin / "claude"
            ollama = home_bin / "ollama"
            for executable in (codex, claude, ollama):
                executable.write_text("#!/bin/sh\n", encoding="utf-8")

            registry = ProviderRegistry(
                platform="linux",
                env={"PATH": "", "XDG_DATA_HOME": str(root / "xdg-data")},
                home=root / "home",
            )
            providers = {item["id"]: item for item in registry.list_providers()}

        self.assertEqual(providers["codex"]["path"], str(codex))
        self.assertEqual(providers["claude"]["path"], str(claude))
        self.assertEqual(providers["ollama"]["path"], str(ollama))

    @patch("waddle.providers.subprocess.run")
    @patch("waddle.providers.shutil.which")
    def test_detects_cli_from_path_and_does_not_claim_authentication(self, which, run):
        which.side_effect = lambda name, path=None: {"codex": r"C:\Tools\codex.exe", "claude": r"C:\Tools\claude.cmd"}.get(name)
        run.return_value = type("Result", (), {"stdout": "codex 1.2.3\n", "stderr": "", "returncode": 0})()

        providers = {
            item["id"]: item
            for item in ProviderRegistry(ollama_path=Path("Z:/missing/ollama.exe"), platform="windows").list_providers()
        }

        self.assertTrue(providers["codex"]["installed"])
        self.assertEqual(providers["codex"]["path"], r"C:\Tools\codex.exe")
        self.assertIn("autenticação não verificada", providers["codex"]["detail"])
        self.assertTrue(providers["claude"]["installed"])

    @patch("waddle.providers.subprocess.run", side_effect=TimeoutError)
    def test_version_probe_is_optional(self, _run):
        self.assertIsNone(ProviderRegistry()._run_version(["missing", "--version"]))

    @patch("waddle.providers.subprocess.run")
    def test_version_output_is_bounded_to_one_line(self, run):
        run.return_value = type(
            "Result", (), {"stdout": ("v" + "x" * 400 + "\nsecond line"), "stderr": ""}
        )()

        version = ProviderRegistry()._run_version(["tool", "--version"])

        self.assertEqual(len(version), 240)
        self.assertNotIn("second line", version)


if __name__ == "__main__":
    unittest.main()
