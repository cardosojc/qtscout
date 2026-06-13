"""Render meeting/document PDFs with Playwright (Chromium). Ports the launch +
page.pdf options from pdf-generator.ts. Templates supply the page shell + CSS.
"""

import base64
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from playwright.async_api import Browser, PdfMargins, Playwright, async_playwright

from app.config import get_settings
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
_FOOTER = (
    '<div style="font-size: 8px; width: 100%; text-align: center; margin-bottom: 10px; '
    'color: #666;"><div style="margin-top: 5px;">CNE - instituição de utilidade pública'
    "</div></div>"
)
_MARGIN: PdfMargins = {"top": "1cm", "right": "2cm", "bottom": "2.5cm", "left": "2cm"}


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


async def _launch_browser(p: Playwright) -> Browser:
    """Connect to a remote Chromium over CDP when BROWSER_WS_URL is set (hosts
    that can't bundle Chromium, e.g. FastAPI Cloud); otherwise launch locally
    (Railway's image bakes Chromium in)."""
    ws_url = get_settings().browser_ws_url
    if ws_url:
        return await p.chromium.connect_over_cdp(ws_url)
    return await p.chromium.launch(headless=True)


async def _render(html: str) -> bytes:
    async with async_playwright() as p:
        browser = await _launch_browser(p)
        try:
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle")
            return await page.pdf(
                format="A4",
                margin=_MARGIN,
                display_header_footer=True,
                header_template="<span></span>",
                footer_template=_FOOTER,
                print_background=True,
            )
        finally:
            await browser.close()


async def generate_meeting_pdf(meeting: dict[str, Any]) -> bytes:
    html = _env.get_template("meeting.html.j2").render(
        title=f"Ata de Reunião - {meeting.get('identifier', '')}",
        body=build_meeting_body(meeting),
        **_header_ctx(),
    )
    return await _render(html)


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
    return await _render(html)
