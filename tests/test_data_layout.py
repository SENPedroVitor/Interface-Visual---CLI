import os
import tempfile
import unittest
from pathlib import Path

from waddle.core.os_layer import get_waddle_data_dir


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


if __name__ == "__main__":
    unittest.main()
