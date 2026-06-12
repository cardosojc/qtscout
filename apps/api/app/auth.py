"""Supabase Bearer-token verification.

Fast path: verify the access token offline against Supabase's asymmetric signing
keys (ES256, served at the JWKS endpoint). The keys are fetched once and cached,
so per-request auth no longer makes a network round-trip. Falls back to the
Supabase Auth API (`GET /auth/v1/user`) when local verification is disabled or
fails — the API path additionally catches server-side revocation, which offline
verification cannot until the (short-lived) token expires.
"""

import asyncio
import re
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from app.config import get_settings

settings = get_settings()

_BEARER = re.compile(r"^Bearer\s+(.+)$", re.IGNORECASE)
_http = httpx.AsyncClient(timeout=10.0)

# Supabase serves its JWT signing keys (ES256) at this JWKS URL; PyJWKClient
# caches them after the first fetch so verification is offline thereafter.
_SUPABASE_BASE = settings.supabase_url.rstrip("/")
_JWKS_URL = f"{_SUPABASE_BASE}/auth/v1/.well-known/jwks.json"
_ISSUER = f"{_SUPABASE_BASE}/auth/v1"
_jwks_client = PyJWKClient(_JWKS_URL)


def bearer_from_header(auth_header: str | None) -> str | None:
    """Extract the raw token from an `Authorization: Bearer <jwt>` header value."""
    if not auth_header:
        return None
    match = _BEARER.match(auth_header.strip())
    return match.group(1) if match else None


def _verify_jwt_local(token: str) -> dict[str, Any] | None:
    """Verify the token offline via JWKS; return `{id, email}` or None.

    Synchronous (PyJWT + cached JWKS); run via a thread so a rare cache-miss
    JWKS fetch doesn't block the event loop.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=_ISSUER,
        )
    except Exception:
        return None
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        return None
    return {"id": sub, "email": claims.get("email")}


async def _verify_via_api(token: str) -> dict[str, Any] | None:
    """Validate the token against the Supabase Auth API (network fallback)."""
    try:
        resp = await _http.get(
            f"{_SUPABASE_BASE}/auth/v1/user",
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


async def verify_supabase_token(token: str) -> dict[str, Any] | None:
    """Return the Supabase user dict for a valid access token, else None."""
    if settings.jwt_local_verify:
        local = await asyncio.to_thread(_verify_jwt_local, token)
        if local is not None:
            return local
    return await _verify_via_api(token)


async def prefetch_jwks() -> None:
    """Warm the JWKS cache at startup (best-effort)."""
    if not settings.jwt_local_verify:
        return
    try:
        await asyncio.to_thread(_jwks_client.get_signing_keys)
    except Exception:
        pass


async def close_http() -> None:
    await _http.aclose()
