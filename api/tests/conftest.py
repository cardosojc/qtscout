"""Hermetic test env — dummy settings so unit tests need no real creds/DB.
Environment variables take precedence over the .env file in pydantic-settings,
so these override any local .env during tests.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:6543/postgres")
os.environ.setdefault("DIRECT_URL", "postgresql://u:p@localhost:5432/postgres")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "anon")
os.environ.setdefault("SUPABASE_SECRET_KEY", "secret")
