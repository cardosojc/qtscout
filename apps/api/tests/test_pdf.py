"""PDF page HTML (rendered by Browser Run in the Worker). Without a browser here,
assert the HTML the renderer would send: fonts inlined, body content present,
no URL the browser would have to fetch (our hostname is behind Access)."""

import re
from datetime import UTC, datetime

import pytest

from app.pdf.render import PdfUnavailable, document_html, generate_meeting_pdf, meeting_html

_MEETING = {
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


def _no_external_urls(html: str) -> None:
    assert not re.search(r"""(?:src|href|url)\(?\s*=?\s*['"]?(?!data:)(?:https?:|/)""", html)


def test_meeting_html_ca_with_signatures() -> None:
    html = meeting_html(_MEETING)
    assert "CA-20260101" in html
    assert "Abertura" in html and "Notas." in html
    assert "João Pereira" in html and "Sofia Reis" in html
    assert "data:font/woff2;base64," in html
    _no_external_urls(html)


def test_document_html_oficio_signed() -> None:
    doc = {
        "type": "OFICIO",
        "content": "<p>Exmo. Senhor,</p><p>Vimos por este meio…</p>",
        "identifier": "OF-001/2026",
        "createdAt": datetime(2026, 1, 1, tzinfo=UTC),
        "createdBy": {"name": "Ana Lima", "email": "ana@example.pt"},
        "signedAt": datetime(2026, 1, 2, tzinfo=UTC),
        "signedBy": {"name": "João Pereira", "roles": ["Chefe de Agrupamento"], "signature": None},
    }
    html = document_html(doc)
    assert "OF-001/2026" in html and "Ofício" in html
    assert "Vimos por este meio" in html
    assert "Saudações Escutistas" in html and "João Pereira" in html
    _no_external_urls(html)


async def test_pdf_renders_locally_or_reports_unavailable() -> None:
    # With Playwright's Chromium installed this is a real PDF; without it, the
    # renderer reports PdfUnavailable (-> 503) rather than failing obscurely.
    try:
        pdf = await generate_meeting_pdf(_MEETING)
    except PdfUnavailable:
        pytest.skip("no local Chromium")
    except Exception as err:  # browser binary missing
        if "Executable doesn't exist" in str(err):
            pytest.skip("Playwright Chromium not installed")
        raise
    assert pdf.startswith(b"%PDF-")
