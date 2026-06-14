"""Render meeting/document PDFs with xhtml2pdf (pisa) — pure-Python, no browser.

Templates supply the page shell + CSS (xhtml2pdf subset: tables for layout,
static @frame header/footer, local @font-face). The synchronous pisa renderer
runs off the event loop via run_in_threadpool so the routers stay async.
"""

import base64
import io
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from starlette.concurrency import run_in_threadpool
from xhtml2pdf import pisa

from app.pdf.html_builders import (
    DOC_TYPE_LABELS,
    build_document_parts,
    build_meeting_body,
    format_date_pt,
)

_DIR = Path(__file__).parent
_env = Environment(loader=FileSystemLoader(str(_DIR / "templates")), autoescape=False)

_HEADER = {
    "line1": "Agrupamento 61 - Santa Maria dos Olivais",
    "line2": "Escutismo Católico Português",
}


def _img(filename: str) -> str:
    try:
        raw = (_DIR / "assets" / filename).read_bytes()
    except OSError:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower()
    mime = "jpeg" if ext == "jpg" else ext
    return f"data:image/{mime};base64,{base64.b64encode(raw).decode()}"


def _header_ctx() -> dict[str, Any]:
    return {**_HEADER, "left_img": _img("scouthouse61.jpeg"), "right_img": _img("cne.jpeg")}


def _link_callback(uri: str, rel: str) -> str:
    """Resolve relative @font-face / asset URIs (e.g. ``fonts/Lato-Regular.ttf``)
    to absolute paths under app/pdf. Data URIs (DB-stored signature images) and
    absolute paths pass through unchanged — pisa handles those directly."""
    if uri.startswith(("data:", "http:", "https:")) or Path(uri).is_absolute():
        return uri
    return str((_DIR / uri).resolve())


def _render(html: str) -> bytes:
    buf = io.BytesIO()
    status = pisa.CreatePDF(src=html, dest=buf, link_callback=_link_callback, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"PDF generation failed ({status.err} error(s))")
    return buf.getvalue()


async def generate_meeting_pdf(meeting: dict[str, Any]) -> bytes:
    html = _env.get_template("meeting.html.j2").render(
        title=f"Ata de Reunião - {meeting.get('identifier', '')}",
        body=build_meeting_body(meeting),
        **_header_ctx(),
    )
    return await run_in_threadpool(_render, html)


async def generate_document_pdf(doc: dict[str, Any]) -> bytes:
    body_content, signature_block = build_document_parts(doc)
    created_by = doc.get("createdBy") or {}
    html = _env.get_template("document.html.j2").render(
        title=doc.get("identifier", ""),
        identifier=doc.get("identifier", ""),
        type_label=DOC_TYPE_LABELS.get(doc.get("type", ""), doc.get("type", "")),
        created_at=format_date_pt(doc["createdAt"]),
        created_by_name=created_by.get("name") or created_by.get("email", ""),
        body_content=body_content,
        signature_block=signature_block,
        **_header_ctx(),
    )
    return await run_in_threadpool(_render, html)
