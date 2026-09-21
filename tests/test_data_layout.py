import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from waddle.core.os_layer import get_waddle_config_dir, get_waddle_data_dir


class DataLayoutTests(unittest.TestCase):
    def test_configured_data_root_creates_runtime_subdirectories(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            previous = os.environ.get("WADDLE_DATA_DIR")
            try:
                os.environ["WADDLE_DATA_DIR"] = str(Path(temp_dir) / "waddle-data")
                root = get_waddle_data_dir()
                self.assertEqual(root, Path(temp_dir) / "waddle-data")
                for folder in ("database", "contexts", "conversations", "artifacts", "exports", "logs", "cache"):
                    self.assertTrue((root / folder).is_dir())
            finally:
                if previous is None:
                    os.environ.pop("WADDLE_DATA_DIR", None)
                else:
                    os.environ["WADDLE_DATA_DIR"] = previous

    def test_xdg_data_and_config_roots_are_used_on_linux(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            env = {
                "XDG_DATA_HOME": str(root / "share"),
                "XDG_CONFIG_HOME": str(root / "config"),
            }
            with patch.dict(os.environ, env, clear=False):
                os.environ.pop("WADDLE_DATA_DIR", None)
                os.environ.pop("WADDLE_CONFIG_DIR", None)
                with patch("waddle.core.os_layer.sys.platform", "linux"):
                    data_dir = get_waddle_data_dir()
                    config_dir = get_waddle_config_dir()

            self.assertEqual(data_dir, root / "share" / "waddle")
            self.assertTrue((data_dir / "database").is_dir())
            self.assertEqual(config_dir, root / "config" / "waddle")
            self.assertTrue((config_dir / "providers").is_dir())

    def test_explicit_config_root_overrides_xdg(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with patch.dict(
                os.environ,
                {"WADDLE_CONFIG_DIR": str(root / "waddle-config"), "XDG_CONFIG_HOME": str(root / "ignored")},
                clear=False,
            ):
                config_dir = get_waddle_config_dir()

            self.assertEqual(config_dir, root / "waddle-config")
            self.assertTrue((config_dir / "ui").is_dir())


if __name__ == "__main__":
    unittest.main()
