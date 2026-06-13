"""Smoke tests for the xhtml2pdf PDF renderer. Assert it produces a valid,
non-trivial PDF from representative meeting/document payloads (mirroring the
router call sites) — a cheap regression guard for the engine + templates."""

from datetime import UTC, datetime

from app.pdf.render import generate_document_pdf, generate_meeting_pdf


def _is_pdf(data: bytes) -> bool:
    return data.startswith(b"%PDF-") and len(data) > 2000


async def test_meeting_pdf_ca_with_signatures() -> None:
    """A CA meeting renders the agenda + the signature page (two-column table)."""
    meeting = {
        "identifier": "CA-20260101",
        "date": datetime(2026, 1, 1, tzinfo=UTC),
        "startTime": "19:00",
        "endTime": "21:00",
        "location": "Sede",
        "meetingType": {"name": "Conselho de Agrupamento", "code": "CA"},
        "createdBy": {"name": "Ana Lima", "email": "ana@example.pt"},
        "agenda": {
            "items": [
                {"title": "Abertura", "description": "Boas-vindas", "content": "<p>Notas.</p>"},
            ],
            "attendeeNames": ["Rui Costa", "Marta Sá"],
            "chefeAgrupamento": "João Pereira",
            "secretario": "Sofia Reis",
        },
    }
    pdf = await generate_meeting_pdf(meeting)
    assert _is_pdf(pdf)


async def test_document_pdf_oficio_signed() -> None:
    """An OFICIO with a handwritten-fallback signature renders to a valid PDF."""
    doc = {
        "type": "OFICIO",
        "content": "<p>Exmo. Senhor,</p><p>Vimos por este meio…</p>",
        "identifier": "OF-001/2026",
        "createdAt": datetime(2026, 1, 1, tzinfo=UTC),
        "createdBy": {"name": "Ana Lima", "email": "ana@example.pt"},
        "signedAt": datetime(2026, 1, 2, tzinfo=UTC),
        "signedBy": {"name": "João Pereira", "roles": ["Chefe de Agrupamento"], "signature": None},
    }
    pdf = await generate_document_pdf(doc)
    assert _is_pdf(pdf)
