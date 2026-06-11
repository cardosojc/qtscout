"""Supabase Bearer-token verification.

Parity with the Hono API's `getSessionFromToken`: the token is validated against
the Supabase Auth API (`GET /auth/v1/user`). (A future optimisation is local JWT
verification to drop this per-request network call — see the migration plan.)
"""

import re
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()

_BEARER = re.compile(r"^Bearer\s+(.+)$", re.IGNORECASE)
_http = httpx.AsyncClient(timeout=10.0)


def bearer_from_header(auth_header: str | None) -> str | None:
    """Extract the raw token from an `Authorization: Bearer <jwt>` header value."""
    if not auth_header:
        return None
    match = _BEARER.match(auth_header.strip())
    return match.group(1) if match else None


async def verify_supabase_token(token: str) -> dict[str, Any] | None:
    """Return the Supabase user dict for a valid access token, else None."""
    try:
        resp = await _http.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_publishable_key,
            },
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    data: dict[str, Any] = resp.json()
    return data


async def close_http() -> None:
    await _http.aclose()
