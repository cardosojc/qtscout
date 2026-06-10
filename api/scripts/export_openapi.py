"""Dump the FastAPI OpenAPI spec to openapi/openapi.json (repo root).

Run: `uv run python scripts/export_openapi.py`. The web app generates its
TypeScript API types from this file (openapi-typescript). Dummy env is set so
the app imports without real credentials.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # api/ on the path

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:6543/postgres")
os.environ.setdefault("DIRECT_URL", "postgresql://u:p@localhost:5432/postgres")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "anon")
os.environ.setdefault("SUPABASE_SECRET_KEY", "secret")

from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "openapi" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
