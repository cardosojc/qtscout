"""Render meeting/document PDFs with Cloudflare Browser Run (headless Chromium).

The page HTML (Jinja2 templates + the body builders) is sent to the Worker's
`BROWSER` binding (`quickAction("pdf")`). The repeating header/footer are
Chromium print templates: they can't load URLs or the page's fonts, so they use
inline styles and data-URI logos. The page fonts (Latin-subset WOFF2) are inlined
as data URIs too — Browser Run can't fetch from our hostname, which sits behind
Cloudflare Access.

Outside the Worker (local dev, E2E) the same HTML and print options go to a
local Chromium via Playwright, if installed (dev dependency); otherwise
`PdfUnavailable` is raised.
"""

import asyncio
import base64
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

from app.pdf.html_builders import (
    DOC_TYPE_LABELS,
    build_document_parts,
    build_meeting_body,
    format_date_pt,
)
from app.runtime import IN_WORKER, binding, to_js_obj

_DIR = Path(__file__).parent
_env = Environment(loader=FileSystemLoader(str(_DIR / "templates")), autoescape=False)

_LINE1 = "Agrupamento 61 - Santa Maria dos Olivais"
_LINE2 = "Escutismo Católico Português"
_LOCATION = "Olivais"

# Page margins; the top/bottom ones hold the header/footer templates.
_MARGIN = {"top": "34mm", "bottom": "18mm", "left": "20mm", "right": "20mm"}


# Browser Run rate-limits quick actions (on Workers Free: 1 every 10 s per
# account). On 429 wait as told by Retry-After, once, up to this many seconds.
_MAX_RETRY_WAIT = 11.0


class PdfUnavailable(RuntimeError):
    """No browser binding (local dev / tests)."""


class PdfBusy(RuntimeError):
    """Browser Run is rate-limiting us; the user should retry shortly."""


def _data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def _font_face(family: str, filename: str, weight: str = "normal") -> str:
    src = _data_uri(_DIR / "fonts" / filename, "font/woff2")
    return (
        f"@font-face {{ font-family: '{family}'; font-weight: {weight}; "
        f"src: url('{src}') format('woff2'); }}"
    )


# Read once at import (lands in the Worker's deploy-time snapshot; ~180 KB).
_FONTS_CSS = "\n".join(
    [
        _font_face("Lato", "Lato-Regular.woff2"),
        _font_face("Lato", "Lato-Bold.woff2", "bold"),
        _font_face("Caveat", "Caveat-Regular.woff2"),
    ]
)
_LEFT_LOGO = _data_uri(_DIR / "assets" / "scouthouse61.jpeg", "image/jpeg")
_RIGHT_LOGO = _data_uri(_DIR / "assets" / "cne.jpeg", "image/jpeg")

# Chromium print templates: font-size must be set explicitly (default is ~0).
_HEADER = f"""<div style="width:100%;margin:0 20mm;font-family:Helvetica,Arial,sans-serif;
-webkit-print-color-adjust:exact;display:flex;align-items:center;justify-content:space-between;">
<img src="{_LEFT_LOGO}" style="width:16mm;height:16mm;object-fit:contain;"/>
<div style="text-align:center;">
<div style="font-size:12pt;font-weight:bold;color:#1e40af;">{_LINE1}</div>
<div style="font-size:8.5pt;color:#555;">{_LINE2}</div>
</div>
<img src="{_RIGHT_LOGO}" style="width:16mm;height:16mm;object-fit:contain;"/>
</div>"""

_FOOTER = """<div style="width:100%;text-align:center;font-family:Helvetica,Arial,sans-serif;
font-size:7pt;color:#666;">CNE - instituição de utilidade pública &nbsp;·&nbsp;
Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>"""


def _retry_after(resp: Any) -> float:
    try:
        seconds = float(resp.headers.get("Retry-After") or _MAX_RETRY_WAIT)
    except (TypeError, ValueError):
        seconds = _MAX_RETRY_WAIT
    return min(max(seconds, 1.0), _MAX_RETRY_WAIT)


async def _render(html: str) -> bytes:
    browser = binding("BROWSER")
    if browser is None:
        return await _render_locally(html)
    options = {
        "html": html,
        "pdfOptions": {
            "format": "a4",
            "printBackground": True,
            "displayHeaderFooter": True,
            "headerTemplate": _HEADER,
            "footerTemplate": _FOOTER,
            "margin": _MARGIN,
        },
    }
    resp = await browser.quickAction("pdf", to_js_obj(options))
    if int(resp.status) == 429:
        await asyncio.sleep(_retry_after(resp))
        resp = await browser.quickAction("pdf", to_js_obj(options))
        if int(resp.status) == 429:
            raise PdfBusy("Browser Run rate limit")
    if int(resp.status) != 200:
        raise RuntimeError(f"PDF generation failed (Browser Run status {resp.status})")
    return bytes(await resp.bytes())


async def _render_locally(html: str) -> bytes:
    """Local dev / E2E: the same Chromium print-to-PDF, via Playwright."""
    if IN_WORKER:
        raise PdfUnavailable("PDF rendering needs the Browser Run binding")
    try:
        from playwright.async_api import PdfMargins, async_playwright
    except ImportError as err:
        raise PdfUnavailable("Install Playwright to render PDFs locally") from err
    async with async_playwright() as pw:
        chromium = await pw.chromium.launch()
        try:
            page = await chromium.new_page()
            await page.set_content(html, wait_until="networkidle")
            return await page.pdf(
                format="A4",
                print_background=True,
                display_header_footer=True,
                header_template=_HEADER,
                footer_template=_FOOTER,
                margin=PdfMargins(**_MARGIN),  # type: ignore[typeddict-item]
            )
        finally:
            await chromium.close()


def meeting_html(meeting: dict[str, Any]) -> str:
    return _env.get_template("meeting.html.j2").render(
        title=f"Ata de Reunião - {meeting.get('identifier', '')}",
        fonts_css=_FONTS_CSS,
        body=build_meeting_body(meeting),
    )


def document_html(doc: dict[str, Any]) -> str:
    body_content, signature_block = build_document_parts(doc)
    return _env.get_template("document.html.j2").render(
        title=doc.get("identifier", ""),
        fonts_css=_FONTS_CSS,
        identifier=doc.get("identifier", ""),
        type_label=DOC_TYPE_LABELS.get(doc.get("type", ""), doc.get("type", "")),
        location=_LOCATION,
        created_at=format_date_pt(doc["createdAt"]),
        body_content=body_content,
        signature_block=signature_block,
    )


async def generate_meeting_pdf(meeting: dict[str, Any]) -> bytes:
    return await _render(meeting_html(meeting))


async def generate_document_pdf(doc: dict[str, Any]) -> bytes:
    return await _render(document_html(doc))
