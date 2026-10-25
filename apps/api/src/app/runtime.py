"""What differs between the Cloudflare Worker (Pyodide) and local CPython.

On Workers the API runs inside Pyodide: the database is the D1 binding, outbound
HTTP goes through the runtime's `fetch`, and env vars/bindings come from the
Worker `env` (copied into `os.environ` by `entry.py` before the app is used).
Locally (uvicorn, pytest) the database is a SQLite file and HTTP uses httpx.
Everything platform-specific lives here so the routers stay identical.
"""

import json
import sys
from contextvars import ContextVar
from typing import Any

IN_WORKER = sys.platform == "emscripten"

# The Worker `env` (bindings: DB, BROWSER, AI, ASSETS) for the current request.
worker_env: ContextVar[Any] = ContextVar("worker_env", default=None)


def binding(name: str) -> Any:
    """A Worker binding by name, or None outside the Worker."""
    env = worker_env.get()
    return getattr(env, name, None) if env is not None else None


def to_js_obj(value: Any) -> Any:
    """Convert a Python dict/list to a plain JS object (for binding calls)."""
    from js import Object
    from pyodide.ffi import to_js

    return to_js(value, dict_converter=Object.fromEntries)


async def http_request(
    method: str, url: str, *, headers: dict[str, str] | None = None, body: Any = None
) -> tuple[int, Any]:
    """Send a request with an optional JSON body; return (status, parsed JSON or None)."""
    payload = json.dumps(body) if body is not None else None
    if IN_WORKER:
        from http import HTTPMethod

        from workers import fetch

        opts: dict[str, Any] = {"method": HTTPMethod(method), "headers": headers or {}}
        if payload is not None:
            opts["body"] = payload
        resp = await fetch(url, **opts)
        text = await resp.text()
        status = int(resp.status)
    else:
        import httpx

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.request(method, url, headers=headers, content=payload)
        text, status = r.text, r.status_code
    try:
        return status, json.loads(text) if text else None
    except ValueError:
        return status, None
