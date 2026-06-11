"""SIIE `export.xlsx` row mapping. Port of `@qtscout/core/siie-import`.

The router reads the workbook (openpyxl) into per-row dicts keyed by the SIIE
header names, then `map_row` validates/normalises each into a ScoutImportPayload.
"""

import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from datetime import timedelta as _td
from typing import Any

from app.models.enums import OrdemSection

EXPECTED_HEADERS = (
    "agrupamento", "nin", "nome", "datanascimento", "dataadmissao", "Sexo",
    "Situacao", "Categoria", "morada", "localidade", "telefone", "CP 1", "CP 2",
    "codigopostal", "telemovel", "email", "pai", "Telefone Pai", "Email Pai",
    "mae", "Telefone Mae", "Email Mae", "Enc Educ", "Enc Educ Telefone",
    "Enc Educ Email", "nif", "cc",
)  # fmt: skip


def category_to_section(categoria: str | None) -> OrdemSection | None:
    if not categoria:
        return None
    last = categoria.strip()[-1:].upper()
    return {
        "L": OrdemSection.ALCATEIA,
        "E": OrdemSection.EXPEDICAO,
        "P": OrdemSection.COMUNIDADE,
        "C": OrdemSection.CLA,
    }.get(last)  # D, AD, ND, DH and anything unknown -> None


def split_name(full: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", full).strip()
    if not cleaned:
        return "", ""
    parts = cleaned.split(" ")
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def parse_excel_date(value: Any) -> datetime | None:
    """Accept a datetime/date, an Excel serial number, or a date string."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        # Excel serial: days since 1899-12-30 (sheetjs default).
        return datetime(1970, 1, 1) + _td(seconds=round((value - 25569) * 86400))
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
        if m:
            dd, mm, yyyy = (int(g) for g in m.groups())
            try:
                return datetime(yyyy, mm, dd)
            except ValueError:
                return None
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def combine_postal_code(cp1: Any, cp2: Any, locality: Any) -> str | None:
    code = f"{str(cp1 or '').strip()}-{str(cp2 or '').strip().rjust(3, '0')}".strip()
    has_code = code not in ("-", "-000")
    loc = locality.strip() if isinstance(locality, str) else ""
    if not has_code and not loc:
        return None
    if has_code and loc:
        return f"{code} {loc}"
    return code if has_code else loc


def clean_str(value: Any) -> str | None:
    if not isinstance(value, str):
        if value is None or value == "":
            return None
        return str(value).strip() or None
    return value.strip() or None


@dataclass
class ScoutImportPayload:
    first_name: str
    last_name: str
    numero_associado: str | None
    date_of_birth: datetime
    joined_at: datetime | None
    section: OrdemSection | None
    active: bool
    sexo: str | None
    cc: str | None
    nif: str | None
    email: str | None
    telefone: str | None
    telemovel: str | None
    morada: str | None
    localidade: str | None
    codigo_postal: str | None
    pai_nome: str | None
    pai_telefone: str | None
    pai_email: str | None
    mae_nome: str | None
    mae_telefone: str | None
    mae_email: str | None
    encarregado_nome: str | None
    encarregado_telefone: str | None
    encarregado_email: str | None


@dataclass
class MapResult:
    ok: bool
    row: int
    nome: str
    nin: str | None = None
    payload: ScoutImportPayload | None = None
    error: str | None = None


def map_row(row: dict[str, Any], row_index: int) -> MapResult:
    nome_raw = row.get("nome")
    nome = nome_raw.strip() if isinstance(nome_raw, str) else ""
    if not nome:
        return MapResult(ok=False, row=row_index, nome="", error="Sem nome")

    nin = clean_str(row.get("nin"))
    if not nin:
        return MapResult(
            ok=False, row=row_index, nome=nome, error="Sem NIN — necessário para upsert"
        )

    date_of_birth = parse_excel_date(row.get("datanascimento"))
    if not date_of_birth:
        return MapResult(ok=False, row=row_index, nome=nome, error="Data de nascimento inválida")

    first_name, last_name = split_name(nome)
    return MapResult(
        ok=True,
        row=row_index,
        nome=nome,
        nin=nin,
        payload=ScoutImportPayload(
            first_name=first_name,
            last_name=last_name,
            numero_associado=nin,
            date_of_birth=date_of_birth,
            joined_at=parse_excel_date(row.get("dataadmissao")),
            section=category_to_section(row.get("Categoria")),
            active=(clean_str(row.get("Situacao")) or "").upper() == "A",
            sexo=clean_str(row.get("Sexo")),
            cc=clean_str(row.get("cc")),
            nif=clean_str(row.get("nif")),
            email=clean_str(row.get("email")),
            telefone=clean_str(row.get("telefone")),
            telemovel=clean_str(row.get("telemovel")),
            morada=clean_str(row.get("morada")),
            localidade=clean_str(row.get("localidade")),
            codigo_postal=combine_postal_code(
                row.get("CP 1"), row.get("CP 2"), row.get("codigopostal")
            ),
            pai_nome=clean_str(row.get("pai")),
            pai_telefone=clean_str(row.get("Telefone Pai")),
            pai_email=clean_str(row.get("Email Pai")),
            mae_nome=clean_str(row.get("mae")),
            mae_telefone=clean_str(row.get("Telefone Mae")),
            mae_email=clean_str(row.get("Email Mae")),
            encarregado_nome=clean_str(row.get("Enc Educ")),
            encarregado_telefone=clean_str(row.get("Enc Educ Telefone")),
            encarregado_email=clean_str(row.get("Enc Educ Email")),
        ),
    )
