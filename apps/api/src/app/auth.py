"""Cloudflare Access identity verification.

The web and the API share one hostname behind a Cloudflare Access application.
After the user signs in (one-time PIN by email), Access attaches a signed JWT to
every request: the `Cf-Access-Jwt-Assertion` header, plus the `CF_Authorization`
cookie. We verify it offline against the team's JWKS (RS256, keys fetched and
cached per isolate) and check the application audience, so per-request auth makes no
network round-trip. The verified email is the identity; `deps.current_user`
maps it to a `Profile`.

`AUTH_MODE=dev` skips Access entirely and authenticates every request as
`AUTH_DEV_EMAIL` — for local development and the Playwright suite, where there
is no Access in front of localhost. Never set it in production.
"""

import json
import time
from typing import Any

import jwt

from app.config import get_settings
from app.runtime import http_request

ACCESS_JWT_HEADER = "cf-access-jwt-assertion"
ACCESS_JWT_COOKIE = "CF_Authorization"

# Team signing keys by `kid`, refreshed at most every _JWKS_TTL seconds (and on
# an unknown kid, which is how Access key rotation shows up).
_JWKS_TTL = 3600.0
_jwks: dict[str, Any] = {}
_jwks_fetched_at = 0.0


async def _fetch_jwks() -> None:
    global _jwks, _jwks_fetched_at
    url = f"https://{get_settings().access_team_domain}/cdn-cgi/access/certs"
    status, body = await http_request("GET", url)
    if status != 200 or not isinstance(body, dict):
        return
    keys = jwt.PyJWKSet.from_json(json.dumps(body)).keys
    _jwks = {k.key_id: k.key for k in keys if k.key_id}
    _jwks_fetched_at = time.monotonic()


async def _signing_key(token: str) -> Any | None:
    kid = jwt.get_unverified_header(token).get("kid")
    if not isinstance(kid, str):
        return None
    stale = time.monotonic() - _jwks_fetched_at > _JWKS_TTL
    if kid not in _jwks or stale:
        await _fetch_jwks()
    return _jwks.get(kid)


async def _verify_access_jwt(token: str) -> str | None:
    """Verify an Access JWT against the team JWKS; return the lower-cased email or None."""
    settings = get_settings()
    try:
        key = await _signing_key(token)
        if key is None:
            return None
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
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
    settings = get_settings()
    if settings.auth_mode == "dev":
        return settings.auth_dev_email.strip().lower() if settings.auth_dev_email else None
    token = header_token or cookie_token
    if not token:
        return None
    return await _verify_access_jwt(token)
