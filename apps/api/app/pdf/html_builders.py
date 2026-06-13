"""Build the dynamic inner HTML for meeting + document PDFs.
Port of the body-building parts of pdf-generator.ts (the outer page shell +
CSS live in the Jinja2 templates).
"""

import json
from datetime import datetime
from typing import Any

from app.pdf.os_content import generate_os_content

_MONTHS_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]  # fmt: skip

DOC_TYPE_LABELS = {"OFICIO": "Ofício", "CIRCULAR": "Circular", "ORDEM_SERVICO": "Ordem de Serviço"}


def format_date_pt(value: str | datetime) -> str:
    """`toLocaleDateString('pt-PT', {year,month:long,day})` → "1 de janeiro de 2026"."""
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace("Z", "+00:00"))
    return f"{dt.day} de {_MONTHS_PT[dt.month - 1]} de {dt.year}"


def _format_time(value: str | None) -> str:
    return value[:5] if value else ""


def _signature_lines(attendees: list[str], chefe: str, secretario: str) -> str:
    signatories: list[dict[str, str]] = []
    if chefe:
        signatories.append({"name": chefe, "role": "Chefe de Agrupamento"})
    if secretario:
        signatories.append({"name": secretario, "role": "Secretário"})
    signatories.extend({"name": name, "role": ""} for name in attendees)

    def cell(person: dict[str, str]) -> str:
        role = (
            f'<p style="font-size: 10px; color: #1e40af; margin: 2px 0 0 0; text-align: center; '
            f'font-weight: 600;">{person["role"]}</p>'
            if person["role"]
            else ""
        )
        return (
            '<div style="border-bottom: 1px solid #374151; height: 40px; margin-bottom: 5px;"></div>'
            '<p style="font-size: 12px; color: #374151; margin: 0; text-align: center; '
            f'font-weight: 500;">{person["name"]}</p>{role}'
            '<p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0; text-align: center;">'
            "Assinatura</p>"
        )

    rows = []
    for i in range(0, len(signatories), 2):
        left = cell(signatories[i])
        right = cell(signatories[i + 1]) if i + 1 < len(signatories) else ""
        rows.append(
            '<table style="width: 100%; margin-bottom: 50px;"><tr>'
            f'<td style="width: 50%; padding-right: 5%; vertical-align: top;">{left}</td>'
            f'<td style="width: 50%; padding-left: 5%; vertical-align: top;">{right}</td>'
            "</tr></table>"
        )
    return "".join(rows)


def _signature_page(attendees: list[str], chefe: str, secretario: str) -> str:
    return (
        '<div class="page-break">'
        '<div style="margin: 40px 0; text-align: center;">'
        '<p style="font-size: 16px; color: #374151; margin-bottom: 30px;">'
        "<strong>Conselho de Agrupamento</strong><br>"
        "Agrupamento 61 - Santa Maria dos Olivais</p></div>"
        '<div style="margin: 40px 0;">'
        '<p style="font-size: 14px; color: #6b7280; margin-bottom: 30px;">'
        "Os abaixo assinados, membros do Conselho de Agrupamento, declaram ter participado na "
        "reunião e concordam com o conteúdo da presente ata.</p></div>"
        f'<div style="margin-top: 50px;">{_signature_lines(attendees, chefe, secretario)}</div>'
        '<div style="margin-top: 60px; text-align: center;">'
        '<div style="border-top: 2px solid #374151; width: 200px; margin: 0 auto; padding-top: 10px;">'
        '<p style="font-size: 12px; color: #6b7280; margin: 0;">Data: _____ / _____ / _________'
        "</p></div></div></div>"
    )


def build_meeting_body(meeting: dict[str, Any]) -> str:
    agenda = meeting.get("agenda")
    items: list[Any]
    attendees: list[str]
    if isinstance(agenda, list):
        items, attendees, chefe, secretario = agenda, [], "", ""
    else:
        agenda = agenda or {}
        items = agenda.get("items") or []
        attendees = agenda.get("attendeeNames") or []
        chefe = agenda.get("chefeAgrupamento") or ""
        secretario = agenda.get("secretario") or ""

    mt = meeting.get("meetingType") or {}
    created_by = meeting.get("createdBy") or {}
    start, end = meeting.get("startTime"), meeting.get("endTime")

    horario = ""
    if start or end:
        horario = (
            '<div class="info-item"><span class="info-label">Horário:</span> '
            f'{_format_time(start) if start else ""}{" - " if start and end else ""}'
            f'{_format_time(end) if end else ""}</div>'
        )
    local = ""
    if meeting.get("location"):
        local = (
            f'<div class="info-item"><span class="info-label">Local:</span> '
            f'{meeting["location"]}</div>'
        )

    participantes = ""
    if attendees or chefe or secretario:
        tags = []
        if chefe:
            tags.append(
                '<span class="attendee-tag" style="background: #1e40af; color: white; '
                f'font-weight: 600;">{chefe} (Chefe de Agrupamento)</span>'
            )
        if secretario:
            tags.append(
                '<span class="attendee-tag" style="background: #059669; color: white; '
                f'font-weight: 600;">{secretario} (Secretário)</span>'
            )
        tags.extend(f'<span class="attendee-tag">{name}</span>' for name in attendees)
        participantes = f'<h2>Participantes</h2><div class="attendees">{" ".join(tags)}</div>'

    agenda_html = ""
    if items:
        blocks = []
        for index, item in enumerate(items):
            desc = f'<p>{item["description"]}</p>' if item.get("description") else ""
            content = ""
            if item.get("content") and str(item["content"]).strip() != "":
                content = (
                    '<div class="content-section" style="margin-top: 10px; margin-left: 15px;">'
                    f'{item["content"]}</div>'
                )
            actions = ""
            if item.get("actionItems"):
                action_blocks = []
                for action in item["actionItems"]:
                    resp = action.get("responsible")
                    due = action.get("dueDate")
                    details = (
                        f'{f"<strong>Responsável:</strong> {resp}" if resp else ""}'
                        f'{" | " if resp and due else ""}'
                        f'{f"<strong>Prazo:</strong> {format_date_pt(due)}" if due else ""}'
                    )
                    action_blocks.append(
                        f'<div class="action-item"><h4>{action.get("description") or ""}</h4>'
                        f'<div class="action-details">{details}</div></div>'
                    )
                actions = (
                    '<div style="margin-top: 10px;"><p style="font-size: 12px; font-weight: bold; '
                    'color: #d97706; margin-bottom: 5px;">Ações a Tomar:</p>'
                    f'{"".join(action_blocks)}</div>'
                )
            blocks.append(
                f'<div class="agenda-item"><h4>{index + 1}. {item.get("title", "")}</h4>'
                f"{desc}{content}{actions}</div>"
            )
        agenda_html = f'<h2>Ordem de Trabalhos</h2>{"".join(blocks)}'

    signature = _signature_page(attendees, chefe, secretario) if mt.get("code") == "CA" else ""

    return (
        '<div class="content"><div class="meeting-info">'
        '<table class="meeting-info-table"><tr><td>'
        f'<div class="info-item"><span class="info-label">Identificador:</span> '
        f'{meeting.get("identifier", "")}</div>'
        f'<div class="info-item"><span class="info-label">Tipo:</span> {mt.get("name", "")}</div>'
        f'<div class="info-item"><span class="info-label">Data:</span> '
        f'{format_date_pt(meeting["date"])}</div>'
        f"{horario}</td><td>{local}"
        f'<div class="info-item"><span class="info-label">Criado por:</span> '
        f'{created_by.get("name") or created_by.get("email", "")}</div>'
        f"</td></tr></table></div>{participantes}{agenda_html}{signature}</div>"
    )


def build_document_parts(doc: dict[str, Any]) -> tuple[str, str]:
    content = doc.get("content") or ""
    is_json = content.lstrip().startswith("{")
    if doc.get("type") == "ORDEM_SERVICO" and is_json:
        try:
            body_content = generate_os_content(json.loads(content))
        except (ValueError, TypeError):
            body_content = f'<div class="doc-content">{content}</div>'
    else:
        body_content = f'<div class="doc-content">{content}</div>'

    signed_by = doc.get("signedBy")
    signature_block = ""
    if signed_by:
        signer_name = signed_by.get("name") or signed_by.get("email") or ""
        roles = signed_by.get("roles") or []
        signer_roles = f" ({', '.join(roles)})" if roles else ""
        if signed_by.get("signature"):
            mark = f'<img src="{signed_by["signature"]}" alt="Assinatura" class="signature-img" />'
        else:
            mark = f'<p class="signature-handwritten">{signer_name}</p>'
        signature_block = (
            '<div class="doc-signature"><p class="signature-greeting">Saudações Escutistas,</p>'
            f'{mark}<p class="signature-name">{signer_name}{signer_roles}</p></div>'
        )

    return body_content, signature_block
