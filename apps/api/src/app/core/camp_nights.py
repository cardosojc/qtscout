"""Camp nights from SIIE's "Atividades por Elemento" export.

Each row is one member's participation in one activity. The columns that matter
(export header, with the underlying field name accepted too):

- nin, idatividade, descricao, siglatipo, datainicio, datafim
- "Nº Noites" (noites): nights the member attended
- "N. Campo" (noitescampo): nights credited as camp nights. 0 when the activity
  doesn't count (contanoitescampo false); leaders can also set it below the
  nights attended, so it is the figure to sum, not "Nº Noites".

Milestones (25/50/75/100/200) are reached on the end date of the activity whose
camp nights take the running total past the threshold, in date order.
"""

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.scout_utils import NIGHTS_BADGE_COUNTS
from app.core.siie_import import parse_excel_date


@dataclass
class CampNightRow:
    nin: str
    activity_id: str
    description: str
    activity_type: str | None
    start_date: datetime
    end_date: datetime | None
    nights: int
    camp_nights: int


@dataclass
class CampNightMapResult:
    ok: bool
    row: int
    payload: CampNightRow | None = None
    error: str | None = None


def _first(row: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in row and row[name] not in (None, ""):
            return row[name]
    return None


def _clean_id(value: Any) -> str | None:
    """NINs/ids may come back from Excel as numbers (1234 or 1234.0)."""
    if value is None or value == "":
        return None
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return 0
    try:
        number = float(str(value).replace(",", "."))
    except ValueError:
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return int(round(number))


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "sim", "s", "yes", "verdadeiro")
    return bool(value)


def map_camp_night_row(row: dict[str, Any], row_index: int) -> CampNightMapResult:
    nin = _clean_id(_first(row, "nin", "NIN"))
    if not nin:
        return CampNightMapResult(False, row_index, error="Sem NIN")
    activity_id = _clean_id(_first(row, "idatividade", "IDAtividade"))
    if not activity_id:
        return CampNightMapResult(False, row_index, error="Sem idatividade")
    start = parse_excel_date(_first(row, "datainicio", "Data Inicio"))
    if not start:
        return CampNightMapResult(False, row_index, error="Data de início inválida")
    end = parse_excel_date(_first(row, "datafim", "Data Fim"))

    nights = _to_int(_first(row, "Nº Noites", "noites"))
    if nights is None:
        return CampNightMapResult(False, row_index, error="Nº de noites inválido")
    camp_raw = _first(row, "N. Campo", "noitescampo")
    if camp_raw is None and "N. Campo" not in row and "noitescampo" not in row:
        # Export without the credited column: fall back to the flag.
        flag = _first(row, "contanoitescampo")
        camp_nights: int | None = nights if _truthy(flag) else 0
    else:
        camp_nights = _to_int(camp_raw)
    if camp_nights is None:
        return CampNightMapResult(False, row_index, error="Nº de noites de campo inválido")

    description = _first(row, "descricao", "Descricao")
    activity_type = _first(row, "siglatipo", "Sigla Tipo")
    return CampNightMapResult(
        ok=True,
        row=row_index,
        payload=CampNightRow(
            nin=nin,
            activity_id=activity_id,
            description=str(description).strip() if description else "(sem descrição)",
            activity_type=str(activity_type).strip() if activity_type else None,
            start_date=start,
            end_date=end,
            nights=nights,
            camp_nights=camp_nights,
        ),
    )


@dataclass
class Milestone:
    count: int
    reached_on: datetime
    activity_id: str
    description: str


def milestones_reached(rows: list[Any]) -> list[Milestone]:
    """Milestones crossed by the running camp-night total, in date order.

    `rows` need start_date, end_date, camp_nights, activity_id, description.
    """
    ordered = sorted(rows, key=lambda r: (r.end_date or r.start_date, r.start_date))
    total = 0
    pending = list(NIGHTS_BADGE_COUNTS)
    reached: list[Milestone] = []
    for r in ordered:
        if not r.camp_nights:
            continue
        total += r.camp_nights
        while pending and total >= pending[0]:
            reached.append(
                Milestone(
                    count=pending.pop(0),
                    reached_on=r.end_date or r.start_date,
                    activity_id=r.activity_id,
                    description=r.description,
                )
            )
    return reached
