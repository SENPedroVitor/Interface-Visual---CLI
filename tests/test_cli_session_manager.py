from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from waddle.terminal.cli_session_manager import CliSessionManager


class CliSessionManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_provider_allowlist_and_workspace_boundary(self) -> None:
        manager = CliSessionManager(self.workspace, env={"PATH": ""})
        with self.assertRaises(ValueError):
            manager.resolve_command("ollama")
        with self.assertRaises(PermissionError):
            manager.start_session("codex", cwd=self.workspace.parent)

    def test_configured_command_is_split_without_shell(self) -> None:
        manager = CliSessionManager(self.workspace, env={"CODEX_CMD": 'codex --no-alt-screen "hello world"'})
        self.assertEqual(manager.resolve_command("codex"), ["codex", "--no-alt-screen", '"hello world"'])

    @patch("waddle.terminal.cli_session_manager.shutil.which", return_value="C:/Tools/codex.exe")
    def test_default_codex_command_is_pipe_safe(self, _which) -> None:
        manager = CliSessionManager(self.workspace, env={"PATH": "C:/Tools"})
        self.assertEqual(
            manager.resolve_command("codex"),
            ["C:/Tools/codex.exe", "exec", "--ephemeral", "-s", "read-only", "-"],
        )

    @patch("waddle.terminal.cli_session_manager.shutil.which", return_value="C:/Tools/codex.exe")
    def test_full_access_mode_uses_danger_full_access_sandbox(self, _which) -> None:
        manager = CliSessionManager(
            self.workspace,
            env={"PATH": "C:/Tools"},
            sandbox_mode="danger-full-access",
        )
        self.assertEqual(
            manager.resolve_command("codex"),
            ["C:/Tools/codex.exe", "exec", "--ephemeral", "-s", "danger-full-access", "-"],
        )

    def test_real_probe_is_limited_to_version_and_emits_exit_event(self) -> None:
        # The only real process used here is Python's harmless --version probe.
        manager = CliSessionManager(self.workspace, env={"CODEX_CMD": sys.executable + " --version"}, timeout_seconds=5)
        session_id = manager.start_session("codex")
        deadline = time.time() + 3
        events = []
        while time.time() < deadline:
            events.extend(manager.poll_events())
            if any(event.kind == "exited" for event in events):
                break
            time.sleep(0.02)
        self.assertTrue(any(event.session_id == session_id and event.kind == "stdout" for event in events))
        self.assertTrue(any(event.kind == "exited" and event.exit_code == 0 for event in events))

    def test_popen_receives_pipes_no_shell_and_workspace(self) -> None:
        class FakeStream:
            def readline(self):
                return b""

        class FakeProcess:
            pid = 123
            stdin = None
            stdout = FakeStream()
            stderr = FakeStream()

            def poll(self):
                return 0

            def wait(self, timeout=None):
                return 0

        calls = {}

        def fake_popen(command, **kwargs):
            calls["command"] = command
            calls["kwargs"] = kwargs
            return FakeProcess()

        manager = CliSessionManager(self.workspace, env={"CLAUDE_CMD": "claude --print"}, popen=fake_popen)
        session_id = manager.start_session("claude")
        self.assertTrue(session_id)
        self.assertEqual(calls["command"], ["claude", "--print"])
        self.assertFalse(calls["kwargs"]["shell"])
        self.assertIs(calls["kwargs"]["stdin"], subprocess.PIPE)
        self.assertIs(calls["kwargs"]["stdout"], subprocess.PIPE)
        self.assertIs(calls["kwargs"]["stderr"], subprocess.PIPE)
        self.assertEqual(calls["kwargs"]["cwd"], str(self.workspace.resolve()))

    def test_output_is_capped(self) -> None:
        class Stream:
            def __init__(self):
                self.done = False

            def readline(self):
                if self.done:
                    return b""
                self.done = True
                return b"0123456789"

        class Process:
            pid = 123
            stdin = None
            stdout = Stream()
            stderr = Stream()

            def poll(self):
                return 0

            def wait(self, timeout=None):
                return 0

        manager = CliSessionManager(self.workspace, env={"CODEX_CMD": "codex"}, output_limit=4, popen=lambda *a, **k: Process())
        manager.start_session("codex")
        time.sleep(0.1)
        output = "".join(event.text for event in manager.poll_events() if event.kind == "stdout")
        self.assertLessEqual(len(output.encode("utf-8")), 4)


if __name__ == "__main__":
    unittest.main()
