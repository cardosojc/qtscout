"""Application settings, loaded from the environment via pydantic-settings.

Mirrors the env the Hono API used (see apps/api), with clean names for the
standalone Python service. See .env.example for the full list.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database (Supabase Postgres). DATABASE_URL is the pooler (transaction mode)
    # used by the app; DIRECT_URL is the direct connection used by Alembic.
    database_url: str
    direct_url: str

    # Supabase auth.
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    # When true (default), access tokens are verified offline against Supabase's
    # JWKS (ES256) instead of via a per-request GET /auth/v1/user network call.
    # Falls back to the network path on failure. Set false to force the API path
    # (e.g. if you need server-side revocation to take effect immediately).
    jwt_local_verify: bool = True

    # AI (rich-text editor polish/formal features).
    mistral_api_key: str | None = None

    # PDF rendering (Playwright/Chromium). When set, connect to a remote Chromium
    # over CDP (e.g. a Browserless endpoint) instead of launching one locally.
    # Required on hosts that can't bundle Chromium + its system libs (e.g. FastAPI
    # Cloud, which only installs Python deps). Unset on Railway, where the Docker
    # image bakes in Chromium and a local launch works.
    browser_ws_url: str | None = None

    # CORS: comma-separated list of allowed web origins.
    web_origin: str = "http://localhost:3000"

    # Server.
    port: int = 3001

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
