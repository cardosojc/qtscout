"""Cloudflare Access identity verification.

The web and the API share one hostname behind a Cloudflare Access application.
After the user signs in (one-time PIN by email), Access attaches a signed JWT to
every request: the `Cf-Access-Jwt-Assertion` header, plus the `CF_Authorization`
cookie. We verify it offline against the team's JWKS (RS256, keys fetched once
and cached) and check the application audience, so per-request auth makes no
network round-trip. The verified email is the identity; `deps.current_user`
maps it to a `Profile`.

`AUTH_MODE=dev` skips Access entirely and authenticates every request as
`AUTH_DEV_EMAIL` — for local development and the Playwright suite, where there
is no Access in front of localhost. Never set it in production.
"""

import asyncio
from typing import Any

import jwt
from jwt import PyJWKClient

from app.config import get_settings

settings = get_settings()

ACCESS_JWT_HEADER = "cf-access-jwt-assertion"
ACCESS_JWT_COOKIE = "CF_Authorization"

_jwks_client: PyJWKClient | None = (
    PyJWKClient(f"https://{settings.access_team_domain}/cdn-cgi/access/certs")
    if settings.auth_mode == "access"
    else None
)


def _verify_access_jwt(token: str) -> str | None:
    """Verify an Access JWT offline via JWKS; return the lower-cased email or None.

    Synchronous (PyJWT + cached JWKS); run via a thread so a rare cache-miss
    JWKS fetch doesn't block the event loop.
    """
    if _jwks_client is None:
        return None
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        claims: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.access_aud,
            issuer=f"https://{settings.access_team_domain}",
        )
    except Exception:
        return None
    email = claims.get("email")
    if not isinstance(email, str) or not email:
        # Service-token JWTs carry no email; they are not user sessions.
        return None
    return email.strip().lower()


async def identify(header_token: str | None, cookie_token: str | None) -> str | None:
    """Return the authenticated email for this request, or None."""
    if settings.auth_mode == "dev":
        return settings.auth_dev_email.strip().lower() if settings.auth_dev_email else None
    token = header_token or cookie_token
    if not token:
        return None
    return await asyncio.to_thread(_verify_access_jwt, token)


async def prefetch_jwks() -> None:
    """Warm the JWKS cache at startup (best-effort)."""
    if _jwks_client is None:
        return
    try:
        await asyncio.to_thread(_jwks_client.get_signing_keys)
    except Exception:
        pass
