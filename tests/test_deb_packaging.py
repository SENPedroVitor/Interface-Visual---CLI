from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_deb.sh"


def _run(
    command: list[str],
    *,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def _write_fake_venv_python(path: Path, *, fail_pip: bool = False) -> None:
    path.write_text(
        textwrap.dedent(
            f"""\
            #!/usr/bin/env bash
            set -euo pipefail
            if [ "$1" = "-m" ] && [ "$2" = "venv" ]; then
              venv_dir="$3"
              mkdir -p "$venv_dir/bin"
              cat > "$venv_dir/bin/python" <<'PY'
            #!/usr/bin/env bash
            set -euo pipefail
            printf '%s\\n' "$*" >> "$WADDLE_FAKE_LOG"
            if [ "{'1' if fail_pip else '0'}" = "1" ] && [ "$1" = "-m" ] && [ "$2" = "pip" ]; then
              exit 42
            fi
            exit 0
            PY
              chmod +x "$venv_dir/bin/python"
              exit 0
            fi
            exit 64
            """
        ),
        encoding="utf-8",
    )
    path.chmod(0o755)


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
            for dependency in (
                "python3",
                "python3-venv",
                "ca-certificates",
                "libgl1",
                "libegl1",
                "libxkbcommon-x11-0",
                "libxcb-cursor0",
            ):
                self.assertIn(dependency, depends)
            for unavailable_dependency in (
                "python3-pyside6",
                "python3-fastapi",
                "python3-uvicorn",
                "python3-pydantic",
            ):
                self.assertNotIn(unavailable_dependency, depends)

            launcher = root / "usr/bin/waddle-desktop"
            desktop = root / "usr/share/applications/waddle.desktop"
            icon = root / "usr/share/icons/hicolor/scalable/apps/waddle.svg"
            app = root / "usr/lib/waddle/src/waddle_desktop/app.py"
            requirements = root / "usr/lib/waddle/requirements.txt"
            self.assertTrue(launcher.exists())
            self.assertTrue(desktop.exists())
            self.assertTrue(icon.exists())
            self.assertTrue(app.exists())
            self.assertTrue(requirements.exists())
            self.assertFalse((root / "usr/lib/waddle/web").exists())
            self.assertFalse((root / "usr/lib/waddle/waddle.db").exists())

            mode = stat.S_IMODE(launcher.stat().st_mode)
            self.assertEqual(0o755, mode)
            launcher_text = launcher.read_text(encoding="utf-8")
            self.assertIn('APP_DIR="${WADDLE_APP_DIR:-/usr/lib/waddle}"', launcher_text)
            self.assertIn('PYTHON="$APP_DIR/venv/bin/python"', launcher_text)
            self.assertIn('exec "$PYTHON" -m waddle_desktop.app "$@"', launcher_text)

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

    def test_maintainer_scripts_and_launcher_run_without_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="waddle-deb-test.") as tmp:
            tmp_path = Path(tmp)
            deb_path = self._build_package(tmp_path)
            root = tmp_path / "extract"
            control = tmp_path / "control"
            _run(["dpkg-deb", "-x", str(deb_path), str(root)])
            _run(["dpkg-deb", "-e", str(deb_path), str(control)])

            postinst = control / "postinst"
            postrm = control / "postrm"
            self.assertEqual(0o755, stat.S_IMODE(postinst.stat().st_mode))
            self.assertEqual(0o755, stat.S_IMODE(postrm.stat().st_mode))

            app_dir = root / "usr/lib/waddle"
            fake_log = tmp_path / "fake-python.log"
            fake_python = tmp_path / "fake-python"
            _write_fake_venv_python(fake_python)

            env = os.environ.copy()
            env.update(
                {
                    "WADDLE_APP_DIR": str(app_dir),
                    "WADDLE_PYTHON": str(fake_python),
                    "WADDLE_FAKE_LOG": str(fake_log),
                }
            )
            _run([str(postinst), "configure"], env=env)

            self.assertTrue((app_dir / "venv/bin/python").exists())
            fake_log_text = fake_log.read_text(encoding="utf-8")
            self.assertIn("-m ensurepip --upgrade", fake_log_text)
            self.assertIn(
                f"-m pip install --prefer-binary -r {app_dir / 'requirements.txt'}",
                fake_log_text,
            )

            launcher_log = tmp_path / "launcher.log"
            (app_dir / "venv/bin/python").write_text(
                textwrap.dedent(
                    f"""\
                    #!/usr/bin/env bash
                    set -euo pipefail
                    {{
                      printf 'pwd=%s\\n' "$PWD"
                      printf 'pythonpath=%s\\n' "${{PYTHONPATH:-}}"
                      printf 'qml_cache=%s\\n' "${{QML_DISABLE_DISK_CACHE:-}}"
                      printf 'args=%s\\n' "$*"
                    }} > {launcher_log}
                    """
                ),
                encoding="utf-8",
            )
            (app_dir / "venv/bin/python").chmod(0o755)

            launcher_env = os.environ.copy()
            launcher_env["WADDLE_APP_DIR"] = str(app_dir)
            launcher_env["PYTHONPATH"] = "existing"
            _run([str(root / "usr/bin/waddle-desktop"), "--smoke"], env=launcher_env)
            launcher_log_text = launcher_log.read_text(encoding="utf-8")
            self.assertIn(f"pwd={app_dir}", launcher_log_text)
            self.assertIn(f"pythonpath={app_dir / 'src'}:existing", launcher_log_text)
            self.assertIn("qml_cache=1", launcher_log_text)
            self.assertIn("args=-m waddle_desktop.app --smoke", launcher_log_text)

    def test_postinst_reports_offline_or_pip_failures_clearly(self) -> None:
        with tempfile.TemporaryDirectory(prefix="waddle-deb-test.") as tmp:
            tmp_path = Path(tmp)
            deb_path = self._build_package(tmp_path)
            root = tmp_path / "extract"
            control = tmp_path / "control"
            _run(["dpkg-deb", "-x", str(deb_path), str(root)])
            _run(["dpkg-deb", "-e", str(deb_path), str(control)])

            app_dir = root / "usr/lib/waddle"
            fake_log = tmp_path / "fake-python.log"
            fake_python = tmp_path / "fake-python"
            _write_fake_venv_python(fake_python, fail_pip=True)

            env = os.environ.copy()
            env.update(
                {
                    "WADDLE_APP_DIR": str(app_dir),
                    "WADDLE_PYTHON": str(fake_python),
                    "WADDLE_FAKE_LOG": str(fake_log),
                }
            )
            result = _run([str(control / "postinst"), "configure"], env=env, check=False)

            self.assertEqual(1, result.returncode)
            self.assertIn("failed to install Python runtime dependencies", result.stderr)
            self.assertIn("do not provide python3-pyside6 through apt", result.stderr)
            self.assertIn("sudo apt --fix-broken install", result.stderr)


if __name__ == "__main__":
    unittest.main()
