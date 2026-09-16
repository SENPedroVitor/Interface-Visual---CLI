from __future__ import annotations

import asyncio
import os
import unittest
from unittest.mock import patch

import httpx

from waddle.api import server


class _CloudWebSocket:
    def __init__(self, messages):
        self.headers = {"origin": "http://127.0.0.1:5173"}
        self.messages = iter(messages)
        self.accepted = False
        self.closed = None

    async def accept(self):
        self.accepted = True

    async def receive_json(self):
        return next(self.messages)

    async def close(self, *, code: int, reason: str):
        self.closed = (code, reason)


class AuthGuardTests(unittest.TestCase):
    def test_local_mode_keeps_api_open(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/status")

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "local"}, clear=False):
            response = asyncio.run(exercise())
        self.assertEqual(response.status_code, 200)

    def test_cloud_mode_rejects_missing_token(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/status")

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase"}, clear=False):
            response = asyncio.run(exercise())
        self.assertEqual(response.status_code, 401)

    def test_cloud_mode_rejects_invalid_token(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/status", headers={"Authorization": "Bearer invalid"})

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase"}, clear=False), patch.object(
            server, "get_user", new=unittest.mock.AsyncMock(return_value=None)
        ):
            response = asyncio.run(exercise())
        self.assertEqual(response.status_code, 401)

    def test_cloud_mode_rejects_authenticated_user_outside_allowlist(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get(
                    "/api/status",
                    headers={
                        "Authorization": "Bearer valid",
                        "Origin": "http://127.0.0.1:5173",
                    },
                )

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase", "WADDLE_ALLOWED_EMAILS": "owner@example.com"}, clear=False), patch.object(
            server, "get_user", new=unittest.mock.AsyncMock(return_value={"id": "u1", "email": "other@example.com"})
        ):
            response = asyncio.run(exercise())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173")

    def test_cloud_mode_allows_user_on_allowlist(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get("/api/status", headers={"Authorization": "Bearer valid"})

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase", "WADDLE_ALLOWED_EMAILS": "owner@example.com"}, clear=False), patch.object(
            server, "get_user", new=unittest.mock.AsyncMock(return_value={"id": "u1", "email": "owner@example.com"})
        ):
            response = asyncio.run(exercise())
        self.assertEqual(response.status_code, 200)

    def test_cloud_mode_allows_cors_preflight_without_auth(self):
        async def exercise():
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.options(
                    "/api/status",
                    headers={
                        "Origin": "http://127.0.0.1:5173",
                        "Access-Control-Request-Method": "GET",
                        "Access-Control-Request-Headers": "authorization",
                    },
                )

        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase"}, clear=False):
            response = asyncio.run(exercise())
        self.assertIn(response.status_code, {200, 204})
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173")

    def test_cloud_websocket_auth_message_is_required_before_registration(self):
        websocket = _CloudWebSocket([{"type": "auth", "access_token": "invalid"}])
        with patch.dict(os.environ, {"WADDLE_AUTH_MODE": "supabase"}, clear=False), patch.object(
            server, "get_user", new=unittest.mock.AsyncMock(return_value=None)
        ):
            asyncio.run(server.websocket_events_endpoint(websocket))
        self.assertTrue(websocket.accepted)
        self.assertEqual(websocket.closed[0], 1008)
        self.assertNotIn(websocket, server.active_websockets)


if __name__ == "__main__":
    unittest.main()
