from __future__ import annotations

import unittest
from pathlib import Path

from scripts.start_waddle import build_parser


class TestLauncherArguments(unittest.TestCase):
    def test_headless_production_and_provider_flags_are_explicit(self):
        args = build_parser().parse_args(["--headless", "--production", "--no-ollama"])

        self.assertTrue(args.no_browser)
        self.assertTrue(args.production)
        self.assertTrue(args.no_ollama)

    def test_powershell_launcher_uses_absolute_project_paths(self):
        script = (Path(__file__).parents[1] / "start.ps1").read_text(encoding="utf-8")

        self.assertIn("Resolve-Path", script)
        self.assertIn("scripts\\start_waddle.py", script)
        self.assertIn("Push-Location -LiteralPath $projectRoot", script)

    def test_autostart_scripts_are_idempotent_and_reversible(self):
        root = Path(__file__).parents[1]
        install = (root / "scripts" / "install_autostart.ps1").read_text(encoding="utf-8")
        uninstall = (root / "scripts" / "uninstall_autostart.ps1").read_text(encoding="utf-8")

        self.assertIn("Register-ScheduledTask", install)
        self.assertIn("-AtLogOn", install)
        self.assertIn("-LogonType Interactive", install)
        self.assertIn("-RunLevel Limited", install)
        self.assertIn("-StartWhenAvailable", install)
        self.assertIn("-MultipleInstances IgnoreNew", install)
        self.assertIn("--headless --no-browser", install)
        self.assertIn("-Force", install)
        self.assertIn("Unregister-ScheduledTask", uninstall)
        self.assertIn("-Confirm:$false", uninstall)


if __name__ == "__main__":
    unittest.main()
