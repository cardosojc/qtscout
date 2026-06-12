from starlette.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}


def test_error_shape_matches_hono() -> None:
    """Errors render as {"error": ...} (not FastAPI's default {"detail": ...})."""
    with TestClient(app) as client:
        resp = client.get("/api/nope")
        assert resp.status_code == 404
        assert resp.json() == {"error": "Not Found"}
