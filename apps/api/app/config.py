"""Application settings, loaded from the environment via pydantic-settings.

Mirrors the env the Hono API used (see apps/api), with clean names for the
standalone Python service. See .env.example for the full list.
"""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database (Supabase Postgres). DATABASE_URL is the pooler (transaction mode)
    # used by the app; DIRECT_URL is the direct connection used by Alembic.
    database_url: str
    direct_url: str

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

    # AI (rich-text editor polish/formal features).
    mistral_api_key: str | None = None

    # CORS: comma-separated list of allowed web origins.
    web_origin: str = "http://localhost:3000"

    # Server.
    port: int = 3001

    @model_validator(mode="after")
    def _check_auth(self) -> "Settings":
        if self.auth_mode == "access" and not (self.access_team_domain and self.access_aud):
            raise ValueError("AUTH_MODE=access requires ACCESS_TEAM_DOMAIN and ACCESS_AUD")
        if self.auth_mode == "dev" and not self.auth_dev_email:
            raise ValueError("AUTH_MODE=dev requires AUTH_DEV_EMAIL")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
