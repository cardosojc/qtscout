"""End-to-end API flows on a real SQLite database with the D1 schema.

Covers what changed with the move from Postgres to D1: the atomic document
numbering batch, OS generation marking its items, the FTS5 meeting search, JSON
and enum columns, and ORM updates/deletes (row counts).
"""

from collections.abc import Iterator

import pytest
from starlette.testclient import TestClient

from app.db import SessionLocal, get_engine
from app.deps import current_user
from app.main import app
from app.models import DocumentSettings, MeetingType, Profile
from app.models.enums import DocumentType, UserRole
from app.schemas.session import SessionUser

ADMIN = SessionUser(
    id="admin-1", email="chefe@exemplo.pt", name="Chefe", username="chefe", role=UserRole.ADMIN
)


@pytest.fixture
def client(db: None) -> Iterator[TestClient]:
    with SessionLocal(bind=get_engine()) as s:
        s.add(
            Profile(
                id=ADMIN.id,
                email=ADMIN.email,
                name=ADMIN.name,
                username=ADMIN.username,
                role=UserRole.ADMIN,
                roles=["Chefe de Agrupamento"],
            )
        )
        s.add(MeetingType(id="mt-ca", code="CA", name="Conselho de Agrupamento"))
        s.commit()
    app.dependency_overrides[current_user] = lambda: ADMIN
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _create_doc(client: TestClient, type_: str = "OFICIO") -> dict:  # type: ignore[type-arg]
    resp = client.post("/api/documents", json={"type": type_, "content": "<p>Olá</p>"})
    assert resp.status_code == 200, resp.text
    return resp.json()  # type: ignore[no-any-return]


def test_profile_roles_json_and_enum(client: TestClient) -> None:
    resp = client.get("/api/auth/profile")
    assert resp.status_code == 200, resp.text
    with SessionLocal(bind=get_engine()) as s:
        profile = s.get(Profile, ADMIN.id)
        assert profile is not None
        assert profile.roles == ["Chefe de Agrupamento"]
        assert profile.role == UserRole.ADMIN


def test_document_numbers_are_sequential(client: TestClient) -> None:
    first, second = _create_doc(client), _create_doc(client)
    assert first["number"] == 1 and second["number"] == 2
    assert first["identifier"].startswith("OF-001/")
    assert second["identifier"].startswith("OF-002/")
    # Types number independently.
    assert _create_doc(client, "CIRCULAR")["number"] == 1


def test_document_numbering_respects_starting_number(client: TestClient) -> None:
    with SessionLocal(bind=get_engine()) as s:
        s.add(DocumentSettings(type=DocumentType.OFICIO, starting_number=40))
        s.commit()
    assert _create_doc(client)["number"] == 40
    assert _create_doc(client)["number"] == 41


def test_document_update_and_delete(client: TestClient) -> None:
    doc = _create_doc(client)
    resp = client.put(f"/api/documents/{doc['id']}", json={"content": "<p>Novo</p>"})
    assert resp.status_code == 200, resp.text
    assert client.get(f"/api/documents/{doc['id']}").json()["content"] == "<p>Novo</p>"
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert client.get(f"/api/documents/{doc['id']}").status_code == 404


def test_os_generation_marks_items_and_numbers(client: TestClient) -> None:
    for text in ("Primeira resolução", "Segunda resolução"):
        resp = client.post(
            "/api/ordem-items",
            json={
                "category": "RESOLUCAO",
                "date": "2026-03-10T00:00:00.000Z",
                "data": {"value": text},
            },
        )
        assert resp.status_code == 200, resp.text

    resp = client.post(
        "/api/ordens-servico/generate",
        json={"from": "2026-03-01T00:00:00.000Z", "to": "2026-03-31T23:59:59.000Z"},
    )
    assert resp.status_code == 200, resp.text
    os_doc = resp.json()
    assert os_doc["identifier"] == "OS-001" and os_doc["itemCount"] == 2

    items = client.get("/api/ordem-items").json()
    listed = items["items"] if isinstance(items, dict) else items
    assert all(i["includedInOsId"] == os_doc["id"] for i in listed)

    # Nothing left pending in the period.
    again = client.post(
        "/api/ordens-servico/generate",
        json={"from": "2026-03-01T00:00:00.000Z", "to": "2026-03-31T23:59:59.000Z"},
    )
    assert again.status_code == 400


def _create_meeting(client: TestClient, date: str, content: str) -> dict:  # type: ignore[type-arg]
    resp = client.post(
        "/api/meetings",
        json={
            "meetingTypeId": "mt-ca",
            "date": date,
            "location": "Sede",
            "agenda": [{"title": "Acampamento de Verão", "content": "<p>Plano</p>"}],
            "content": content,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()  # type: ignore[no-any-return]


def test_meeting_search_is_accent_insensitive_with_snippet(client: TestClient) -> None:
    hit = _create_meeting(
        client, "2026-01-10T19:00:00.000Z", "<p>Reunião sobre as <strong>nomeações</strong></p>"
    )
    _create_meeting(client, "2026-02-10T19:00:00.000Z", "<p>Outro assunto</p>")

    results = client.get("/api/search/meetings", params={"q": "reuniao nomea"}).json()
    assert [r["id"] for r in results] == [hit["id"]]
    assert "<mark>" in results[0]["snippet"] and "<strong>" not in results[0]["snippet"]
    assert results[0]["date"] == "2026-01-10T19:00:00.000Z"
    assert results[0]["meetingType"]["code"] == "CA"

    # Agenda text is indexed too.
    assert len(client.get("/api/search/meetings", params={"q": "verao"}).json()) == 2


def test_meeting_search_follows_updates_and_deletes(client: TestClient) -> None:
    m = _create_meeting(client, "2026-01-10T19:00:00.000Z", "<p>Texto antigo</p>")
    resp = client.put(f"/api/meetings/{m['id']}", json={"content": "<p>Texto renovado</p>"})
    assert resp.status_code == 200, resp.text
    assert client.get("/api/search/meetings", params={"q": "antigo"}).json() == []
    assert len(client.get("/api/search/meetings", params={"q": "renovado"}).json()) == 1

    assert client.delete(f"/api/meetings/{m['id']}").status_code == 200
    assert client.get("/api/search/meetings", params={"q": "renovado"}).json() == []


def test_meeting_date_range_filter(client: TestClient) -> None:
    _create_meeting(client, "2026-01-10T19:00:00.000Z", "<p>Janeiro</p>")
    _create_meeting(client, "2026-02-10T19:00:00.000Z", "<p>Fevereiro</p>")
    results = client.get(
        "/api/search/meetings",
        params={"q": "sede", "from": "2026-02-01T00:00:00.000Z", "to": "2026-02-28T00:00:00.000Z"},
    ).json()
    assert [r["date"] for r in results] == ["2026-02-10T19:00:00.000Z"]


def test_scouts_sort_ignores_accents_and_case(client: TestClient) -> None:
    for first, last, section in (
        ("Zé", "Silva", "ALCATEIA"),
        ("Álvaro", "Silva", "ALCATEIA"),
        ("ana", "Éça", "ALCATEIA"),
        ("Rui", "Costa", None),
    ):
        body = {"firstName": first, "lastName": last, "dateOfBirth": "2015-01-01T00:00:00.000Z"}
        if section:
            body["section"] = section
        resp = client.post("/api/scouts", json=body)
        assert resp.status_code in (200, 201), resp.text
    scouts = client.get("/api/scouts").json()["scouts"]
    assert [(s["firstName"], s["lastName"]) for s in scouts] == [
        ("ana", "Éça"),
        ("Álvaro", "Silva"),
        ("Zé", "Silva"),
        ("Rui", "Costa"),
    ]


def test_nights_badges_save_update_and_clear(client: TestClient) -> None:
    scout = client.post(
        "/api/scouts",
        json={"firstName": "Rui", "lastName": "Sá", "dateOfBirth": "2014-01-01T00:00:00.000Z"},
    ).json()["scout"]
    url = f"/api/scouts/{scout['id']}/nights-badges"

    def put(awarded: str | None) -> dict:  # type: ignore[type-arg]
        resp = client.put(url, json={"badges": [{"count": 25, "awardedAt": awarded}]})
        assert resp.status_code == 200, resp.text
        return resp.json()  # type: ignore[no-any-return]

    assert [b["awardedAt"][:10] for b in put("2026-10-01")["badges"]] == ["2026-10-01"]
    # Saving again updates the same milestone (the upsert path).
    assert [b["awardedAt"][:10] for b in put("2026-10-05")["badges"]] == ["2026-10-05"]
    # An empty date removes it.
    assert put("")["badges"] == []
