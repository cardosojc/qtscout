"""Compare the old Hono API and the new FastAPI API for response parity.

Run locally (it surfaces real data, so it is NOT run in CI/transcripts):

    HONO_URL=http://localhost:3001 \
    FASTAPI_URL=http://localhost:8000 \
    TOKEN="<supabase access token>" \
    uv run python scripts/parity_check.py

Add paths to GET_ENDPOINTS as routers are ported. Exits non-zero on any diff.
The token is read from a logged-in web session (DevTools → Application → the
Supabase auth cookie/localStorage access_token) or any Supabase sign-in.
"""

import json
import os
import sys
from typing import Any

import httpx

HONO_URL = os.environ.get("HONO_URL", "http://localhost:3001")
FASTAPI_URL = os.environ.get("FASTAPI_URL", "http://localhost:8000")
TOKEN = os.environ.get("TOKEN")

# Read-only GET endpoints to compare. Extend as routers land.
GET_ENDPOINTS: list[str] = [
    "/api/health",
    "/api/meeting-types",
    "/api/settings/documents",
]


def fetch(base: str, path: str) -> tuple[int, Any]:
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    resp = httpx.get(f"{base}{path}", headers=headers, timeout=30.0)
    ctype = resp.headers.get("content-type", "")
    body: Any = resp.json() if ctype.startswith("application/json") else resp.text
    return resp.status_code, body


def main() -> None:
    failures = 0
    for path in GET_ENDPOINTS:
        old_status, old_body = fetch(HONO_URL, path)
        new_status, new_body = fetch(FASTAPI_URL, path)
        ok = old_status == new_status and old_body == new_body
        print(f"[{'OK  ' if ok else 'DIFF'}] GET {path}  hono={old_status} fastapi={new_status}")
        if not ok:
            failures += 1
            print("    hono   :", json.dumps(old_body, ensure_ascii=False)[:400])
            print("    fastapi:", json.dumps(new_body, ensure_ascii=False)[:400])
    if failures:
        print(f"\n{failures} endpoint(s) differ")
        sys.exit(1)
    print(f"\nAll {len(GET_ENDPOINTS)} endpoint(s) match")


if __name__ == "__main__":
    main()
