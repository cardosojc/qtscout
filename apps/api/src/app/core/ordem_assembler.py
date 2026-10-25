"""Fold OrdemItem rows into an OrdemServicoData snapshot.
Port of `@qtscout/core/ordem-assembler`.
"""

from collections.abc import Sequence
from typing import Any

from app.core.ordem_resolver import ResolvedRefs, profile_label, scout_label
from app.core.ordem_servico import SECTION_KEY, default_ordem_servico_data
from app.models import OrdemItem


def _as_string(data: Any) -> str:
    value = (data or {}).get("value")
    return value if isinstance(value, str) else ""


def _as_atividade(data: Any) -> dict[str, str]:
    d = data or {}
    return {
        "nome": d["nome"] if isinstance(d.get("nome"), str) else "",
        "datas": d["datas"] if isinstance(d.get("datas"), str) else "",
        "local": d["local"] if isinstance(d.get("local"), str) else "",
    }


def _ref_scout_name(data: Any, refs: ResolvedRefs) -> str:
    d = data or {}
    if not isinstance(d.get("scoutId"), str):
        return ""
    return scout_label(refs.scouts.get(d["scoutId"]))


def _ref_scout_names(data: Any, refs: ResolvedRefs) -> list[str]:
    """Resolve the member names of a bulk ref (`scoutIds`), tolerating a legacy
    single `scoutId`."""
    d = data or {}
    if isinstance(d.get("scoutIds"), list):
        ids = [i for i in d["scoutIds"] if isinstance(i, str)]
    elif isinstance(d.get("scoutId"), str):
        ids = [d["scoutId"]]
    else:
        ids = []
    return [scout_label(refs.scouts.get(i)) for i in ids]


def _ref_profile_nomeacao(data: Any, refs: ResolvedRefs) -> dict[str, str]:
    d = data or {}
    profile = refs.profiles.get(d["profileId"]) if isinstance(d.get("profileId"), str) else None
    return {
        "nome": profile_label(profile),
        "cargo": d["cargo"] if isinstance(d.get("cargo"), str) else "",
    }


def _ref_mixed_nomeacao(data: Any, refs: ResolvedRefs) -> dict[str, str]:
    d = data or {}
    nome = ""
    if d.get("kind") == "scout" and isinstance(d.get("refId"), str):
        nome = scout_label(refs.scouts.get(d["refId"]))
    elif d.get("kind") == "profile" and isinstance(d.get("refId"), str):
        nome = profile_label(refs.profiles.get(d["refId"]))
    return {"nome": nome, "cargo": d["cargo"] if isinstance(d.get("cargo"), str) else ""}


def add_noites_member(buckets: list[dict[str, Any]], count: int, membro: str) -> None:
    """Merge a member into a section's noites-de-campo buckets, grouped by count.
    Dedupes by name so a member logged manually *and* auto-included from a
    milestone (same section + count) appears once. Shared by the assembler
    (manual NOITES_CAMPO items) and the OS generator (auto badge inclusion)."""
    for b in buckets:
        if b.get("count") == count:
            if membro and membro not in b["membros"]:
                b["membros"].append(membro)
            return
    buckets.append({"count": count, "membros": [membro] if membro else []})


def assemble_ordem_servico(
    items: Sequence[OrdemItem], periodo: dict[str, str], refs: ResolvedRefs
) -> dict[str, Any]:
    data = default_ordem_servico_data()
    data["periodo"] = periodo
    distincao_pieces: list[str] = []

    for item in items:
        section = SECTION_KEY.get(item.section) if item.section else None
        category = item.category
        d = item.data

        if category == "RESOLUCAO":
            data["determinacoes"]["resolucoes"].append(_as_string(d))
        elif category == "DETERMINACAO":
            data["determinacoes"]["determinacoes"].append(_as_string(d))
        elif category == "ATIVIDADE":
            if section:
                data["atividades"][section].append(_as_atividade(d))
            else:
                data["atividades"]["agrupamento"].append(_as_atividade(d))
        elif category == "CRIACAO":
            if section:
                data["criacaoExtincao"]["criacao"][section].append(_as_string(d))
        elif category == "EXTINCAO":
            if section:
                data["criacaoExtincao"]["extincao"][section].append(_as_string(d))
        elif category == "NOMEACAO_DIRIGENTE":
            data["nomeacoes"]["dirigentes"].append(_ref_profile_nomeacao(d, refs))
        elif category == "NOMEACAO_SECCAO":
            if section:
                data["nomeacoes"][section].append(_ref_mixed_nomeacao(d, refs))
        elif category == "NOMEACAO_DEPARTAMENTO":
            data["nomeacoes"]["departamentos"].append(_as_string(d))
        elif category == "ADMISSAO":
            if section:
                data["efetivo"]["admissao"][section].append(_ref_scout_name(d, refs))
        elif category == "READMISSAO":
            if section:
                data["efetivo"]["readmissao"][section].append(_ref_scout_name(d, refs))
        elif category == "TRANSFERENCIA":
            if section:
                data["efetivo"]["transferencia"][section].append(_ref_scout_name(d, refs))
        elif category == "PASSAGEM":
            if section:
                data["efetivo"]["passagens"][section].append(_ref_scout_name(d, refs))
        elif category == "INVESTIDURA":
            if section:
                data["efetivo"]["investiduras"][section].append(_ref_scout_name(d, refs))
        elif category == "SAIDA_ATIVO_SECCAO":
            if section:
                data["efetivo"]["saidaAtivo"][section].append(_ref_scout_name(d, refs))
        elif category == "SAIDA_ATIVO_DIRIGENTE":
            data["efetivo"]["saidaAtivo"]["dirigentes"].append(_as_string(d))
        elif category == "PROGRESSO":
            if section:
                etapa = d["etapa"] if isinstance((d or {}).get("etapa"), str) else ""
                for nome in _ref_scout_names(d, refs):
                    data["sistemaProgresso"][section].append({"nome": nome, "etapa": etapa})
        elif category == "ESPECIALIDADE":
            if section:
                esp = d["especialidade"] if isinstance((d or {}).get("especialidade"), str) else ""
                for nome in _ref_scout_names(d, refs):
                    data["especialidades"][section].append({"nome": nome, "especialidade": esp})
        elif category == "NOITES_CAMPO":
            if section:
                cd = d or {}
                count = cd["count"] if isinstance(cd.get("count"), (int, float)) else 0
                if count:
                    for nome in _ref_scout_names(cd, refs):
                        add_noites_member(data["noitesCampo"][section], int(count), nome)
        elif category == "ACCAO_DISCIPLINAR":
            data["justicaDisciplina"]["accoesDisicplinares"].append(_as_string(d))
        elif category == "DISTINCAO_PREMIO":
            distincao_pieces.append(_as_string(d))
        elif category == "RETIFICACAO":
            data["retificacoes"].append(_as_string(d))

    data["justicaDisciplina"]["distincoesPremios"] = "\n\n".join(distincao_pieces)
    for buckets in data["noitesCampo"].values():
        buckets.sort(key=lambda b: b.get("count", 0))
    return data
