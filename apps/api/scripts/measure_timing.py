"""Probe the API->Supabase latency budget without manual steps.

Self-authenticates against Supabase (password grant, reusing the e2e test user),
then repeatedly hits the diagnostic ``/api/_debug/timing`` endpoint and the
unauthenticated ``/api/health`` floor, and prints percentiles per hop. Run it
against local (EU->EU) and the deployed API to fill the slowness budget table.

The target API must be started with ``DEBUG_TIMING=true`` (the probe endpoint is
gated behind it and AdminUser — the e2e test user is ADMIN).

Usage (from apps/api/):

    # local API on :3001, started with DEBUG_TIMING=true
    uv run python scripts/measure_timing.py

    # explicit target + more iterations
    MEASURE_ITERATIONS=30 uv run python scripts/measure_timing.py https://qtscout-api.up.railway.app

Auth/Supabase config is read from the API's own settings (.env). Override the
test user with E2E_TEST_EMAIL / E2E_TEST_PASSWORD, or skip auth entirely by
passing MEASURE_TOKEN=<supabase access token>.

This is diagnostic scaffolding — remove alongside the DEBUG_TIMING instrumentation.
"""

import os
import statistics
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # api/ on the path

from app.config import get_settings  # noqa: E402

settings = get_settings()

API_URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MEASURE_API_URL", "http://localhost:3001")).rstrip("/")
ITERATIONS = int(os.environ.get("MEASURE_ITERATIONS", "20"))
EMAIL = os.environ.get("E2E_TEST_EMAIL", "e2e-test@qtscout.test")
PASSWORD = os.environ.get("E2E_TEST_PASSWORD", "TestPassword123!")

# Fields returned by /api/_debug/timing, in display order.
PROBE_FIELDS = ["supabase_auth_ms", "select1_ms", "pool_checkout_ms", "meetings_query_ms"]


def get_token() -> str:
    """Return a Supabase access token (env override or password grant)."""
    if token := os.environ.get("MEASURE_TOKEN"):
        return token
    resp = httpx.post(
        f"{settings.supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": settings.supabase_publishable_key},
        json={"email": EMAIL, "password": PASSWORD},
        timeout=15.0,
    )
    if resp.status_code != 200:
        sys.exit(
            f"Supabase password grant failed ({resp.status_code}): {resp.text}\n"
            f"Set MEASURE_TOKEN=<access token> or E2E_TEST_EMAIL/E2E_TEST_PASSWORD."
        )
    return str(resp.json()["access_token"])


def summarise(name: str, samples: list[float]) -> str:
    if not samples:
        return f"  {name:<22} (no samples)"
    s = sorted(samples)
    p95 = s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))]
    return (
        f"  {name:<22} min={min(s):7.1f}  median={statistics.median(s):7.1f}  "
        f"p95={p95:7.1f}  max={max(s):7.1f}"
    )


def main() -> None:
    print(f"Target API : {API_URL}")
    print(f"Iterations : {ITERATIONS}")
    print(f"Supabase   : {settings.supabase_url}\n")

    # 1. Browser->API floor: unauthenticated /api/health round-trip (incl. cold start).
    health: list[float] = []
    with httpx.Client(timeout=30.0) as client:
        for i in range(ITERATIONS):
            t0 = time.perf_counter()
            r = client.get(f"{API_URL}/api/health")
            dt = (time.perf_counter() - t0) * 1000.0
            r.raise_for_status()
            health.append(dt)
            if i == 0:
                print(f"First /api/health (cold-start candidate): {dt:.1f}ms\n")

    # 2. In-process API->Supabase budget via the diagnostic endpoint.
    token = get_token()
    probes: dict[str, list[float]] = {f: [] for f in PROBE_FIELDS}
    roundtrip: list[float] = []
    with httpx.Client(timeout=30.0, headers={"Authorization": f"Bearer {token}"}) as client:
        for _ in range(ITERATIONS):
            t0 = time.perf_counter()
            r = client.get(f"{API_URL}/api/_debug/timing")
            roundtrip.append((time.perf_counter() - t0) * 1000.0)
            if r.status_code == 404:
                sys.exit("Got 404 — start the API with DEBUG_TIMING=true.")
            if r.status_code == 403:
                sys.exit("Got 403 — the authenticated user is not ADMIN.")
            r.raise_for_status()
            data = r.json()
            for f in PROBE_FIELDS:
                if data.get(f, -1) >= 0:
                    probes[f].append(data[f])

    print("=== Browser -> API (network RTT, ms) ===")
    print(summarise("health_rtt", health))
    print("\n=== API -> Supabase, measured inside the process (ms) ===")
    for f in PROBE_FIELDS:
        print(summarise(f, probes[f]))
    print("\n=== Probe endpoint full round-trip (ms) ===")
    print(summarise("debug_timing_rtt", roundtrip))
    print(
        "\nRead: health_rtt = browser->API network; supabase_auth_ms = the per-request\n"
        "auth hop; select1_ms = raw DB round-trip; meetings_query_ms = real list query.\n"
        "Run this against local and the deployed API; compare the columns."
    )


if __name__ == "__main__":
    main()
