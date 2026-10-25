"""Camp nights from SIIE "Atividades por Elemento": mapping, milestones, import."""

import io
from collections.abc import Iterator
from datetime import datetime
from types import SimpleNamespace

import pytest
from openpyxl import Workbook  # type: ignore[import-untyped]
from starlette.testclient import TestClient

from app.core.camp_nights import map_camp_night_row, milestones_reached
from app.db import SessionLocal, get_engine
from app.deps import current_user
from app.main import app
from app.models import Profile, Scout
from app.models.enums import UserRole
from app.schemas.session import SessionUser

HEADER = [
    "nin", "nome", "idatividade", "descricao", "local", "datainicio", "datafim",
    "siglatipo", "siglagrupo", "Noites At.", "Nº Noites", "N. Campo", "siglaseccao",
    "contanoitescampo",
]  # fmt: skip


def _row(**kw: object) -> dict[str, object]:
    base: dict[str, object] = {
        "nin": 1001,
        "idatividade": 77,
        "descricao": "Acampamento",
        "datainicio": datetime(2025, 7, 1),
        "datafim": datetime(2025, 7, 6),
        "siglatipo": "acamp",
        "Nº Noites": 5,
        "N. Campo": 5,
        "contanoitescampo": True,
    }
    return {**base, **kw}


def test_maps_numeric_ids_and_credited_nights() -> None:
    m = map_camp_night_row(_row(nin=1001.0, **{"N. Campo": 3}), 2)
    assert m.ok and m.payload is not None
    assert m.payload.nin == "1001" and m.payload.activity_id == "77"
    assert m.payload.nights == 5 and m.payload.camp_nights == 3  # leader-reduced


def test_falls_back_to_flag_without_credited_column() -> None:
    row = _row()
    del row["N. Campo"]
    assert map_camp_night_row(row, 2).payload.camp_nights == 5  # type: ignore[union-attr]
    row["contanoitescampo"] = False
    assert map_camp_night_row(row, 2).payload.camp_nights == 0  # type: ignore[union-attr]


def test_rejects_rows_without_nin_or_date() -> None:
    assert map_camp_night_row(_row(nin=None), 2).error == "Sem NIN"
    assert map_camp_night_row(_row(datainicio="x"), 2).error == "Data de início inválida"


def test_milestones_use_the_activity_that_crosses_the_threshold() -> None:
    def r(day: int, nights: int, aid: str) -> SimpleNamespace:
        d = datetime(2025, 1, day)
        return SimpleNamespace(
            start_date=d, end_date=d, camp_nights=nights, activity_id=aid, description=aid
        )

    rows = [r(20, 30, "c"), r(1, 20, "a"), r(10, 0, "zero"), r(15, 10, "b")]
    reached = milestones_reached(rows)
    # Date order a(20) -> b(30, crosses 25) -> c(60, crosses 50).
    assert [(m.count, m.activity_id) for m in reached] == [(25, "b"), (50, "c")]


# ---- import endpoint ----

ADMIN = SessionUser(id="a1", email="a@b.pt", name="A", username="a", role=UserRole.ADMIN)


@pytest.fixture
def client(db: None) -> Iterator[TestClient]:
    with SessionLocal(bind=get_engine()) as s:
        s.add(Profile(id="a1", email="a@b.pt", name="A", username="a", role=UserRole.ADMIN))
        s.add(
            Scout(
                id="s1",
                first_name="Rui",
                last_name="Sá",
                numero_associado="1001",
                date_of_birth=datetime(2014, 1, 1),
            )
        )
        s.commit()
    app.dependency_overrides[current_user] = lambda: ADMIN
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _xlsx(rows: list[dict[str, object]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(HEADER)
    for r in rows:
        ws.append([r.get(h) for h in HEADER])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _import(client: TestClient, rows: list[dict[str, object]]) -> dict:  # type: ignore[type-arg]
    files = {"file": ("export.xlsx", _xlsx(rows), "application/octet-stream")}
    resp = client.post("/api/scouts/import-camp-nights", files=files)
    assert resp.status_code == 200, resp.text
    return resp.json()["summary"]  # type: ignore[no-any-return]


def test_import_totals_milestones_and_replace(client: TestClient) -> None:
    rows = [
        _row(idatividade=1, datainicio=datetime(2024, 7, 1), datafim=datetime(2024, 7, 21),
             **{"Nº Noites": 20, "N. Campo": 20}),
        _row(idatividade=2, datainicio=datetime(2024, 11, 1), datafim=datetime(2024, 11, 3),
             siglatipo="jcida", contanoitescampo=False, **{"Nº Noites": 2, "N. Campo": 0}),
        _row(idatividade=3, datainicio=datetime(2025, 3, 1), datafim=datetime(2025, 3, 9),
             **{"Nº Noites": 8, "N. Campo": 6}),
        _row(nin=9999, idatividade=4),  # former member, unknown here
        _row(nin=None),  # broken row
    ]  # fmt: skip
    summary = _import(client, rows)
    assert summary["matchedScouts"] == 1 and summary["unmatchedMembers"] == 1
    assert summary["imported"] == 3 and summary["errorCount"] == 1

    assert client.get("/api/scouts/camp-nights").json() == {"totals": {"s1": 26}}

    # Badge 25 already recorded by a leader: reported as recorded.
    client.put(
        "/api/scouts/s1/nights-badges", json={"badges": [{"count": 25, "awardedAt": "2025-04-01"}]}
    )
    detail = client.get("/api/scouts/s1/camp-nights").json()
    assert detail["total"] == 26 and len(detail["activities"]) == 3
    assert detail["milestones"] == [
        {
            "count": 25,
            "reachedOn": "2025-03-09T00:00:00.000Z",
            "activityId": "3",
            "description": "Acampamento",
            "recordedOn": "2025-04-01T00:00:00.000Z",
        }
    ]

    # Re-import without activity 3: SIIE is the source of truth, so it disappears.
    _import(client, rows[:2])
    assert client.get("/api/scouts/camp-nights").json() == {"totals": {"s1": 20}}
    assert client.get("/api/scouts/s1/camp-nights").json()["milestones"] == []
