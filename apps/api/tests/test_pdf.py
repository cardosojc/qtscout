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


def _count_overlapping_blocks(pdf: bytes) -> tuple[int, int]:
    """Return (page_count, overlapping_block_pairs). Guards against the xhtml2pdf
    pagination bug where an explicit content @frame piled content onto one page
    overlapping, instead of flowing across pages (see templates' @page comment)."""
    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    overlaps = 0
    for page in doc:
        blocks = [b for b in page.get_text("blocks") if b[4].strip()]
        for i in range(len(blocks)):
            for j in range(i + 1, len(blocks)):
                a, b = blocks[i], blocks[j]
                v = min(a[3], b[3]) - max(a[1], b[1])
                h = min(a[2], b[2]) - max(a[0], b[0])
                if v > 5 and h > 20:
                    overlaps += 1
    return doc.page_count, overlaps


async def test_meeting_pdf_long_paginates_without_overlap() -> None:
    """A long meeting must flow across multiple pages with no overlapping text."""
    items = [
        {
            "title": f"Ponto {i + 1} com um título razoavelmente longo",
            "description": "Descrição do ponto.",
            "content": "<p>" + ("Texto de conteúdo para encher a página. " * 12) + "</p>",
        }
        for i in range(12)
    ]
    meeting = {
        "identifier": "RD-20260520",
        "date": datetime(2026, 5, 20, tzinfo=UTC),
        "meetingType": {"name": "Reunião de Direção", "code": "RD"},
        "createdBy": {"name": "Ana Lima", "email": "ana@example.pt"},
        "agenda": {"items": items, "attendeeNames": [], "chefeAgrupamento": "", "secretario": ""},
    }
    pdf = await generate_meeting_pdf(meeting)
    pages, overlaps = _count_overlapping_blocks(pdf)
    assert pages > 1, "long meeting should span multiple pages"
    assert overlaps == 0, f"content overlaps on the page ({overlaps} pairs)"


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
