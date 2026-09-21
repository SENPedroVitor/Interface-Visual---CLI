from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_deb.sh"


def _run(command: list[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )


class TestDebPackaging(unittest.TestCase):
    def _build_package(self, output_dir: Path) -> Path:
        env = os.environ.copy()
        env["WADDLE_DEB_OUTPUT_DIR"] = str(output_dir)
        env["SOURCE_DATE_EPOCH"] = "1700000000"
        result = _run([str(BUILD_SCRIPT)], env=env)
        deb_path = Path(result.stdout.strip().splitlines()[-1])
        self.assertTrue(deb_path.exists(), result.stdout + result.stderr)
        self.assertEqual(output_dir, deb_path.parent)
        return deb_path

    def _field(self, deb_path: Path, name: str) -> str:
        return _run(["dpkg-deb", "-f", str(deb_path), name]).stdout.strip()

    def test_package_metadata_and_installed_layout(self) -> None:
        with tempfile.TemporaryDirectory(prefix="waddle-deb-test.") as tmp:
            tmp_path = Path(tmp)
            deb_path = self._build_package(tmp_path)
            root = tmp_path / "extract"
            _run(["dpkg-deb", "-x", str(deb_path), str(root)])

            self.assertEqual("waddle", self._field(deb_path, "Package"))
            self.assertEqual("0.1.0", self._field(deb_path, "Version"))
            self.assertEqual("all", self._field(deb_path, "Architecture"))
            depends = self._field(deb_path, "Depends")
            for dependency in ("python3", "python3-fastapi", "python3-pyside6", "libxkbcommon-x11-0"):
                self.assertIn(dependency, depends)

            launcher = root / "usr/bin/waddle-desktop"
            desktop = root / "usr/share/applications/waddle.desktop"
            icon = root / "usr/share/icons/hicolor/scalable/apps/waddle.svg"
            app = root / "usr/lib/waddle/src/waddle_desktop/app.py"
            self.assertTrue(launcher.exists())
            self.assertTrue(desktop.exists())
            self.assertTrue(icon.exists())
            self.assertTrue(app.exists())
            self.assertFalse((root / "usr/lib/waddle/web").exists())
            self.assertFalse((root / "usr/lib/waddle/waddle.db").exists())

            mode = stat.S_IMODE(launcher.stat().st_mode)
            self.assertEqual(0o755, mode)
            launcher_text = launcher.read_text(encoding="utf-8")
            self.assertIn('APP_DIR="/usr/lib/waddle"', launcher_text)
            self.assertIn("python3 -m waddle_desktop.app", launcher_text)

            desktop_text = desktop.read_text(encoding="utf-8")
            self.assertIn("Name=Waddle", desktop_text)
            self.assertIn("Exec=waddle-desktop", desktop_text)
            self.assertIn("TryExec=waddle-desktop", desktop_text)
            self.assertIn("Icon=waddle", desktop_text)
            if shutil.which("desktop-file-validate"):
                _run(["desktop-file-validate", str(desktop)])

    def test_build_is_reproducible_with_fixed_source_date_epoch(self) -> None:
        with tempfile.TemporaryDirectory(prefix="waddle-deb-test.") as tmp:
            tmp_path = Path(tmp)
            first = self._build_package(tmp_path)
            first_hash = hashlib.sha256(first.read_bytes()).hexdigest()
            second = self._build_package(tmp_path)
            second_hash = hashlib.sha256(second.read_bytes()).hexdigest()

            self.assertEqual(first, second)
            self.assertEqual(first_hash, second_hash)


if __name__ == "__main__":
    unittest.main()
