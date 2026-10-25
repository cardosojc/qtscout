"""Hermetic test env — dummy settings so unit tests need no real creds/DB.
Environment variables take precedence over the .env file in pydantic-settings,
so these override any local .env during tests.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:6543/postgres")
os.environ.setdefault("DIRECT_URL", "postgresql://u:p@localhost:5432/postgres")
os.environ.setdefault("AUTH_MODE", "access")
os.environ.setdefault("ACCESS_TEAM_DOMAIN", "example.cloudflareaccess.com")
os.environ.setdefault("ACCESS_AUD", "test-aud")
