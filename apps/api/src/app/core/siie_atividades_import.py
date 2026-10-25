"""SIIE `export (1).xlsx` activity row mapping.
Port of `@qtscout/core/siie-atividades-import`.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.siie_import import parse_excel_date  # identical date parser

_LETTER_TO_SECTION = {"L": "ALCATEIA", "E": "EXPEDICAO", "P": "COMUNIDADE", "C": "CLA"}


@dataclass
class ActivityPayload:
    external_id: str
    date: datetime
    section: str | None
    nome: str
    datas: str
    local: str


@dataclass
class ActivityMapResult:
    ok: bool
    row: int
    descricao: str
    payload: ActivityPayload | None = None
    error: str | None = None


def _format_day_pt(d: datetime) -> str:
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def section_from_sigla_seccao(value: str | None) -> str | None:
    """Only a single-letter Sigla Seccao maps to a section; else Agrupamento-level."""
    if not value:
        return None
    letters = [s.strip() for s in value.split(",") if s.strip()]
    if len(letters) != 1:
        return None
    return _LETTER_TO_SECTION.get(letters[0].upper())


def map_activity_row(row: dict[str, Any], row_index: int) -> ActivityMapResult:
    external_id = row["idatividade"].strip() if isinstance(row.get("idatividade"), str) else ""
    descricao = row["descricao"].strip() if isinstance(row.get("descricao"), str) else ""
    if not external_id:
        return ActivityMapResult(False, row_index, descricao, error="Sem idatividade")
    if not descricao:
        return ActivityMapResult(False, row_index, "(sem descrição)", error="Sem descrição")

    start = parse_excel_date(row.get("Data Inicio"))
    if not start:
        return ActivityMapResult(False, row_index, descricao, error="Data Início inválida")
    end = parse_excel_date(row.get("Data Fim"))

    datas = (
        f"{_format_day_pt(start)} a {_format_day_pt(end)}"
        if end and end != start
        else _format_day_pt(start)
    )
    return ActivityMapResult(
        ok=True,
        row=row_index,
        descricao=descricao,
        payload=ActivityPayload(
            external_id=external_id,
            date=start,
            section=section_from_sigla_seccao(row.get("Sigla Seccao")),
            nome=descricao,
            datas=datas,
            local=row["local"].strip() if isinstance(row.get("local"), str) else "",
        ),
    )
