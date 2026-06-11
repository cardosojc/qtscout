"""OS item catalog + per-shape validation. Port of `@qtscout/types/ordem-item`.

Single source of truth for shape (form rendering), scope (permission checks),
and assembler routing. When adding a category, mirror the steps in the TS file.
"""

from dataclasses import dataclass
from typing import Any, Literal

ItemShape = Literal[
    "STRING",
    "TEXT",
    "ATIVIDADE",
    "NOMEACAO",
    "NOITES",
    "MEMBER_REF",
    "NOITES_REF",
    "PROFILE_REF",
    "SCOUT_OR_PROFILE_REF",
]
ItemScope = Literal["GROUP", "SECTION", "BOTH"]

ORDEM_SECTIONS = ("ALCATEIA", "EXPEDICAO", "COMUNIDADE", "CLA")
ORDEM_SECTION_LABELS = {
    "ALCATEIA": "Alcateia",
    "EXPEDICAO": "Expedição",
    "COMUNIDADE": "Comunidade",
    "CLA": "Clã",
}


@dataclass(frozen=True)
class CategorySpec:
    key: str
    label: str
    shape: ItemShape
    scope: ItemScope


ORDEM_CATEGORIES: tuple[CategorySpec, ...] = (
    CategorySpec("RESOLUCAO", "Resolução do Conselho de Agrupamento", "STRING", "GROUP"),
    CategorySpec("DETERMINACAO", "Determinação do Conselho de Agrupamento", "STRING", "GROUP"),
    CategorySpec("ATIVIDADE", "Atividade", "ATIVIDADE", "BOTH"),
    CategorySpec("CRIACAO", "Criação (bando/patrulha/equipa/tribo)", "STRING", "SECTION"),
    CategorySpec("EXTINCAO", "Extinção (bando/patrulha/equipa/tribo)", "STRING", "SECTION"),
    CategorySpec("NOMEACAO_DIRIGENTE", "Nomeação/Exoneração de Dirigente", "PROFILE_REF", "GROUP"),
    CategorySpec(
        "NOMEACAO_SECCAO", "Nomeação/Exoneração na Secção", "SCOUT_OR_PROFILE_REF", "SECTION"
    ),
    CategorySpec("NOMEACAO_DEPARTAMENTO", "Nomeação/Exoneração em Departamento", "STRING", "GROUP"),
    CategorySpec("READMISSAO", "Readmissão de Associado", "MEMBER_REF", "SECTION"),
    CategorySpec("TRANSFERENCIA", "Transferência de Associado", "MEMBER_REF", "SECTION"),
    CategorySpec("PASSAGEM", "Passagem de Secção", "MEMBER_REF", "SECTION"),
    CategorySpec("INVESTIDURA", "Investidura", "MEMBER_REF", "SECTION"),
    CategorySpec("SAIDA_ATIVO_SECCAO", "Saída do Ativo (Secção)", "MEMBER_REF", "SECTION"),
    CategorySpec("SAIDA_ATIVO_DIRIGENTE", "Saída do Ativo (Dirigente)", "STRING", "GROUP"),
    CategorySpec("PROGRESSO", "Sistema de Progresso", "MEMBER_REF", "SECTION"),
    CategorySpec("ACCAO_DISCIPLINAR", "Ação Disciplinar", "STRING", "GROUP"),
    CategorySpec("DISTINCAO_PREMIO", "Distinção ou Prémio", "TEXT", "GROUP"),
    CategorySpec("RETIFICACAO", "Retificação", "STRING", "GROUP"),
)

CATEGORY_MAP: dict[str, CategorySpec] = {c.key: c for c in ORDEM_CATEGORIES}


def is_ordem_category_key(value: Any) -> bool:
    return isinstance(value, str) and value in CATEGORY_MAP


def is_ordem_section(value: Any) -> bool:
    return isinstance(value, str) and value in ORDEM_SECTIONS


@dataclass
class ValidateResult:
    ok: bool
    value: dict[str, Any] | None = None
    error: str | None = None


def _to_float(value: Any) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


def validate_item_data(shape: ItemShape, data: Any) -> ValidateResult:
    if data is None or not isinstance(data, dict):
        return ValidateResult(False, error="data deve ser um objeto")
    d = data

    if shape in ("STRING", "TEXT"):
        value = d.get("value")
        if not isinstance(value, str) or value.strip() == "":
            return ValidateResult(False, error="value (texto) é obrigatório")
        return ValidateResult(True, value={"value": value.strip()})

    if shape == "ATIVIDADE":
        nome = d.get("nome")
        if not isinstance(nome, str) or nome.strip() == "":
            return ValidateResult(False, error="nome é obrigatório")
        return ValidateResult(
            True,
            value={
                "nome": nome.strip(),
                "datas": d["datas"].strip() if isinstance(d.get("datas"), str) else "",
                "local": d["local"].strip() if isinstance(d.get("local"), str) else "",
            },
        )

    if shape == "NOMEACAO":
        nome = d.get("nome")
        if not isinstance(nome, str) or nome.strip() == "":
            return ValidateResult(False, error="nome é obrigatório")
        return ValidateResult(
            True,
            value={
                "nome": nome.strip(),
                "cargo": d["cargo"].strip() if isinstance(d.get("cargo"), str) else "",
            },
        )

    if shape == "NOITES":
        count = _to_float(d.get("count"))
        if count is None or count <= 0:
            return ValidateResult(False, error="count deve ser um número positivo")
        membros = (
            [m.strip() for m in d.get("membros", []) if isinstance(m, str) and m.strip() != ""]
            if isinstance(d.get("membros"), list)
            else []
        )
        return ValidateResult(True, value={"count": int(count), "membros": membros})

    if shape == "MEMBER_REF":
        scout_id = d.get("scoutId")
        if not isinstance(scout_id, str) or not scout_id:
            return ValidateResult(False, error="Membro obrigatório")
        return ValidateResult(True, value={"scoutId": scout_id})

    if shape == "NOITES_REF":
        count = _to_float(d.get("count"))
        if count is None or count <= 0:
            return ValidateResult(False, error="count deve ser um número positivo")
        scout_ids = (
            [m for m in d.get("scoutIds", []) if isinstance(m, str) and m != ""]
            if isinstance(d.get("scoutIds"), list)
            else []
        )
        return ValidateResult(True, value={"count": int(count), "scoutIds": scout_ids})

    if shape == "PROFILE_REF":
        profile_id = d.get("profileId")
        if not isinstance(profile_id, str) or not profile_id:
            return ValidateResult(False, error="Dirigente obrigatório")
        cargo = d["cargo"].strip() if isinstance(d.get("cargo"), str) else ""
        return ValidateResult(True, value={"profileId": profile_id, "cargo": cargo})

    if shape == "SCOUT_OR_PROFILE_REF":
        kind = d.get("kind") if d.get("kind") in ("scout", "profile") else None
        if not kind:
            return ValidateResult(False, error="Tipo de referência inválido")
        ref_id = d.get("refId")
        if not isinstance(ref_id, str) or not ref_id:
            return ValidateResult(False, error="Referência obrigatória")
        cargo = d["cargo"].strip() if isinstance(d.get("cargo"), str) else ""
        return ValidateResult(True, value={"kind": kind, "refId": ref_id, "cargo": cargo})

    return ValidateResult(False, error="Shape desconhecido")
