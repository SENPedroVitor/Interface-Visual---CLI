import asyncio
import unittest

import httpx

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

    def test_validation_errors_redact_oversized_api_keys(self):
        sentinel = "SENSITIVE_SENTINEL_123456789"

        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.post(
                    "/api/credentials/openai",
                    json={"api_key": sentinel * 400},
                )

        response = asyncio.run(exercise())

        self.assertEqual(response.status_code, 422)
        self.assertNotIn(sentinel, response.text)
        self.assertNotIn('"key"', response.text)


if __name__ == "__main__":
    unittest.main()
