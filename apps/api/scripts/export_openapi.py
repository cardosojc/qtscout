"""Dump the FastAPI OpenAPI spec to openapi/openapi.json (repo root).

Run: `uv run python scripts/export_openapi.py`. The web app generates its
TypeScript API types from this file (openapi-typescript). Dummy env is set so
the app imports without real credentials.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

os.environ.setdefault("AUTH_MODE", "dev")
os.environ.setdefault("AUTH_DEV_EMAIL", "export@local")

from app.main import app  # noqa: E402

OUT = Path(__file__).resolve().parents[3] / "openapi" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
