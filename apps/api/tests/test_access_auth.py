"""Access JWT verification (app.auth) against a locally generated RSA key."""

from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import auth

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_ISS = "https://example.cloudflareaccess.com"


class _FakeJWKS:
    def get_signing_key_from_jwt(self, _token: str) -> Any:
        return type("K", (), {"key": _KEY.public_key()})()


@pytest.fixture(autouse=True)
def _fake_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "_jwks_client", _FakeJWKS())


def _token(**claims: Any) -> str:
    base = {"aud": ["test-aud"], "iss": _ISS, "email": "Chefe@Exemplo.PT"}
    return jwt.encode({**base, **claims}, _KEY, algorithm="RS256")


async def test_valid_token_returns_lowercased_email() -> None:
    assert await auth.identify(_token(), None) == "chefe@exemplo.pt"


async def test_cookie_is_used_when_header_missing() -> None:
    assert await auth.identify(None, _token()) == "chefe@exemplo.pt"


async def test_wrong_audience_rejected() -> None:
    assert await auth.identify(_token(aud=["other-app"]), None) is None


async def test_wrong_issuer_rejected() -> None:
    assert await auth.identify(_token(iss="https://evil.cloudflareaccess.com"), None) is None


async def test_service_token_without_email_rejected() -> None:
    assert await auth.identify(_token(email=None), None) is None


async def test_forged_signature_rejected() -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode({"aud": ["test-aud"], "iss": _ISS, "email": "a@b.pt"}, other, "RS256")
    assert await auth.identify(forged, None) is None


async def test_no_token() -> None:
    assert await auth.identify(None, None) is None
