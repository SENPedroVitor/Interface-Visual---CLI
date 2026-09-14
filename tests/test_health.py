from __future__ import annotations

import asyncio
import unittest

from fastapi import HTTPException

import waddle.api.server as server


class TestHealthEndpoint(unittest.TestCase):
    def test_health_reports_ready_payload(self):
        payload = asyncio.run(server.health())
        self.assertTrue(payload["ready"])
        self.assertEqual(payload["status"], "ok")
        self.assertIn("providers", payload["checks"])

    def test_health_returns_503_when_runtime_is_not_ready(self):
        original_get_agent = server.runtime.get_agent
        server.runtime.get_agent = lambda _name: None
        try:
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(server.health())
            self.assertEqual(raised.exception.status_code, 503)
            self.assertFalse(raised.exception.detail["ready"])
        finally:
            server.runtime.get_agent = original_get_agent


if __name__ == "__main__":
    unittest.main()
