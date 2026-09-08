import asyncio
import unittest
from pathlib import Path

from waddle.core.os_layer import (
    get_platform_name,
    get_waddle_data_dir,
    get_workspace_dir,
    run_os_command,
)


class TestOSLayer(unittest.TestCase):
    def test_platform_name(self):
        plat = get_platform_name()
        self.assertIn(plat, ["windows", "linux", "macos"])

    def test_data_dir_exists_or_creatable(self):
        data_dir = get_waddle_data_dir()
        self.assertTrue(data_dir.exists())
        self.assertTrue(data_dir.is_dir())

    def test_workspace_dir(self):
        ws = get_workspace_dir()
        self.assertTrue(ws.exists())

    def test_run_os_command_echo(self):
        cmd = "echo hello_waddle"
        res = asyncio.run(run_os_command(cmd))
        self.assertEqual(res.exit_code, 0)
        self.assertIn("hello_waddle", res.stdout)


if __name__ == "__main__":
    unittest.main()
