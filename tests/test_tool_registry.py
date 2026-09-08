import asyncio
import tempfile
import unittest
from pathlib import Path

from waddle.tools.registry import ToolRegistry, Tool, Permission, RiskLevel
from waddle.tools.filesystem import register_filesystem_tools
from waddle.tools.shell import register_shell_tools


class TestToolRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = ToolRegistry()
        register_filesystem_tools(self.registry)
        register_shell_tools(self.registry)

    def test_registered_tools_exist(self):
        tools = self.registry.list_tools()
        names = [t["name"] for t in tools]
        self.assertIn("read_file", names)
        self.assertIn("write_file", names)
        self.assertIn("list_directory", names)
        self.assertIn("run_command", names)

    def test_file_write_and_read(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            test_path = str(Path(tmpdir) / "sample.txt")
            content = "Waddle Agent OS Test Content"

            # Execute write_file
            res_write = asyncio.run(
                self.registry.execute("write_file", {"path": test_path, "content": content})
            )
            self.assertTrue(res_write.success)

            # Execute read_file
            res_read = asyncio.run(
                self.registry.execute("read_file", {"path": test_path})
            )
            self.assertTrue(res_read.success)
            self.assertEqual(res_read.result, content)

    def test_permission_deny(self):
        self.registry.set_permission("run_command", Permission.DENY)
        res = asyncio.run(
            self.registry.execute("run_command", {"command": "echo test"})
        )
        self.assertFalse(res.success)
        self.assertIn("DENIED", res.error)


if __name__ == "__main__":
    unittest.main()
