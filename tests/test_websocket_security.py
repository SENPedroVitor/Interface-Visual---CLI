import asyncio
import unittest

from waddle.api import server


class _FakeWebSocket:
    def __init__(self, origin: str | None):
        self.headers = {"origin": origin} if origin is not None else {}
        self.closed = None

    async def close(self, *, code: int, reason: str):
        self.closed = (code, reason)


class WebSocketSecurityTests(unittest.TestCase):
    def test_unknown_origin_is_rejected_before_accept(self):
        websocket = _FakeWebSocket("https://evil.example")

        asyncio.run(server.websocket_events_endpoint(websocket))

        self.assertEqual(websocket.closed[0], 1008)

    def test_missing_origin_is_rejected(self):
        websocket = _FakeWebSocket(None)

        asyncio.run(server.websocket_events_endpoint(websocket))

        self.assertEqual(websocket.closed[0], 1008)

    def test_configured_ui_origin_is_allowed(self):
        websocket = _FakeWebSocket("http://127.0.0.1:5173")

        self.assertTrue(server._websocket_origin_allowed(websocket))


if __name__ == "__main__":
    unittest.main()
