"""Small Supabase Auth guard used by the HTTP and WebSocket API."""
from __future__ import annotations

import os
from typing import Any, Optional

import httpx


class AuthUnavailableError(RuntimeError):
    """The configured identity provider could not be reached/configured."""


def auth_enabled() -> bool:
    """Return whether cloud authentication was explicitly enabled."""
    mode = os.getenv("WADDLE_AUTH_MODE", "local").strip().lower()
    return mode not in {"", "local", "off", "disabled", "false", "0"}


def user_is_allowed(user: Optional[dict[str, Any]]) -> bool:
    """Fail closed in cloud mode unless the explicit email allowlist is set."""
    if not user:
        return False
    configured = {
        item.strip().lower()
        for item in os.getenv("WADDLE_ALLOWED_EMAILS", "").split(",")
        if item.strip()
    }
    email = str(user.get("email", "")).strip().lower()
    return bool(configured and email and email in configured)


def bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    scheme, _, token = authorization.strip().partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


async def get_user(authorization: Optional[str]) -> Optional[dict[str, Any]]:
    """Validate a token with Supabase Auth's official get-user endpoint.

    The anon key is only used as the API routing key; the bearer token is
    validated by Supabase. Tokens and Authorization headers are never logged.
    """
    token = bearer_token(authorization)
    if not token:
        return None
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    anon_key = (
        os.getenv("SUPABASE_ANON_KEY", "").strip()
        or os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    )
    if not base_url or not anon_key:
        raise AuthUnavailableError("Supabase Auth não está configurado.")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{base_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": anon_key},
            )
    except httpx.HTTPError as exc:
        raise AuthUnavailableError("Supabase Auth indisponível.") from exc
    if response.status_code in {401, 403}:
        return None
    if response.status_code >= 400:
        raise AuthUnavailableError("Supabase Auth retornou erro.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise AuthUnavailableError("Resposta inválida do Supabase Auth.") from exc
    return payload if isinstance(payload, dict) and payload.get("id") else None
