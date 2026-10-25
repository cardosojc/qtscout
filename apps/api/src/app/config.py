"""Application settings, loaded from the environment via pydantic-settings.

In the Worker these come from the Worker env (vars + secrets), copied into
`os.environ` by `entry.py` before first use. See .env.example for the full list.
Never read settings at import time: the Worker imports modules at deploy time
(memory snapshot), before any env exists.
"""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local SQLite database (unused in the Worker, which uses the D1 binding).
    database_url: str = "sqlite:///./local.db"

    # Auth: Cloudflare Access (see app/auth.py). "access" verifies the Access JWT
    # against the team JWKS + application audience. "dev" trusts every request as
    # AUTH_DEV_EMAIL — local dev / Playwright only, never in production.
    auth_mode: Literal["access", "dev"] = "access"
    access_team_domain: str = ""  # e.g. snowy-hall-cc58.cloudflareaccess.com
    access_aud: str = ""  # the Access application's AUD tag
    auth_dev_email: str | None = None

    # Access group membership management (user create/delete), app/access_admin.py.
    cf_api_token: str | None = None
    cf_account_id: str | None = None
    access_group_id: str | None = None

    # Server.
    port: int = 3001

    @model_validator(mode="after")
    def _check_auth(self) -> "Settings":
        if self.auth_mode == "access" and not (self.access_team_domain and self.access_aud):
            raise ValueError("AUTH_MODE=access requires ACCESS_TEAM_DOMAIN and ACCESS_AUD")
        if self.auth_mode == "dev" and not self.auth_dev_email:
            raise ValueError("AUTH_MODE=dev requires AUTH_DEV_EMAIL")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
