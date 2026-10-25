import pytest

from app.config import Settings


def test_access_mode_requires_team_domain_and_aud() -> None:
    with pytest.raises(ValueError, match="ACCESS_TEAM_DOMAIN"):
        Settings(
            database_url="x",
            direct_url="x",
            auth_mode="access",
            access_team_domain="",
            access_aud="",
        )


def test_dev_mode_requires_dev_email() -> None:
    with pytest.raises(ValueError, match="AUTH_DEV_EMAIL"):
        Settings(database_url="x", direct_url="x", auth_mode="dev", auth_dev_email=None)


def test_dev_mode_ok() -> None:
    s = Settings(database_url="x", direct_url="x", auth_mode="dev", auth_dev_email="a@b.pt")
    assert s.auth_mode == "dev"
