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
    # Optional: when set, JWTs are verified locally (HS256) instead of via a
    # network call to supabase.auth.get_user(). Falls back to the network path.
    supabase_jwt_secret: str | None = None

    # AI (rich-text editor polish/formal features).
    mistral_api_key: str | None = None

    # CORS: comma-separated list of allowed web origins.
    web_origin: str = "http://localhost:3000"

    # Server.
    port: int = 3001

    # Diagnostic: when true, exposes GET /api/_debug/timing (slowness probe).
    debug_timing: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
