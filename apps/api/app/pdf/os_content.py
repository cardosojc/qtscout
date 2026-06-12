"""Render OrdemServicoData into the OS document body HTML.
Port of the OS render helpers + generateOSContent in pdf-generator.ts.
"""

from typing import Any

SECCAO_LABELS = {
    "alcateia": "Alcateia",
    "expedicao": "Expedição",
    "comunidade": "Comunidade",
    "cla": "Clã",
}
SECCOES = ("alcateia", "expedicao", "comunidade", "cla")

_NADA = '<p style="color:#9ca3af;font-style:italic;margin:4px 0 4px 16px;">Nada consta</p>'


def _render_str_list(items: list[str]) -> str:
    if not items:
        return _NADA
    lis = "".join(f'<li style="margin:2px 0;">{i}</li>' for i in items)
    return f'<ul style="margin:4px 0 4px 16px;padding-left:18px;">{lis}</ul>'


def _render_ativ_list(items: list[dict[str, Any]]) -> str:
    if not items:
        return _NADA
    lis = []
    for a in items:
        datas = f" — {a['datas']}" if a.get("datas") else ""
        local = f" — {a['local']}" if a.get("local") else ""
        lis.append(f'<li style="margin:2px 0;">{a.get("nome", "")}{datas}{local}</li>')
    return f'<ul style="margin:4px 0 4px 16px;padding-left:18px;">{"".join(lis)}</ul>'


def _render_nom_list(items: list[dict[str, Any]]) -> str:
    if not items:
        return _NADA
    lis = []
    for n in items:
        cargo = f" — {n['cargo']}" if n.get("cargo") else ""
        lis.append(f'<li style="margin:2px 0;">{n.get("nome", "")}{cargo}</li>')
    return f'<ul style="margin:4px 0 4px 16px;padding-left:18px;">{"".join(lis)}</ul>'


def _render_noites_list(items: list[dict[str, Any]]) -> str:
    if not items:
        return _NADA
    out = []
    for m in items:
        membros = m.get("membros") or []
        if not membros:
            inner = '<p style="color:#9ca3af;font-style:italic;margin:2px 0 2px 16px;">Nenhum membro</p>'
        else:
            lis = "".join(f'<li style="margin:1px 0;">{nome}</li>' for nome in membros)
            inner = f'<ul style="margin:2px 0 2px 16px;padding-left:18px;">{lis}</ul>'
        out.append(
            f'<div style="margin:4px 0 4px 16px;">'
            f'<p style="font-weight:600;margin:0 0 2px 0;">{m.get("count", 0)} noites de campo</p>'
            f"{inner}</div>"
        )
    return "".join(out)


def _sec_title(text: str) -> str:
    return (
        f'<h2 style="font-size:13px;font-weight:700;color:#1e40af;border-bottom:1px solid #e5e7eb;'
        f'padding-bottom:4px;margin:16px 0 6px 0;">{text}</h2>'
    )


def _sub_title(text: str) -> str:
    return f'<h3 style="font-size:12px;font-weight:600;color:#374151;margin:10px 0 3px 0;">{text}</h3>'


def _sub_sub_title(text: str) -> str:
    return f'<p style="font-size:11px;font-weight:500;color:#6b7280;margin:6px 0 2px 8px;">{text}</p>'


def _by_section(render: Any, source: dict[str, Any], sub: bool = False) -> str:
    title = _sub_sub_title if sub else _sub_title
    return "".join(
        f"{title(SECCAO_LABELS[key])}{render(source.get(key) or [])}" for key in SECCOES
    )


def generate_os_content(data: dict[str, Any]) -> str:
    periodo = data.get("periodo") or {}
    de, ate = periodo.get("de"), periodo.get("ate")
    periodo_line = ""
    if de or ate:
        periodo_line = (
            '<p style="margin:0 0 20px 0;font-size:13px;color:#374151;"><strong>Período:</strong> '
            f'{f"De {de}" if de else ""}{" a " if de and ate else ""}'
            f'{f"até {ate}" if ate else ""}</p>'
        )

    det = data.get("determinacoes") or {}
    atividades = data.get("atividades") or {}
    criacao_extincao = data.get("criacaoExtincao") or {}
    nomeacoes = data.get("nomeacoes") or {}
    efetivo = data.get("efetivo") or {}
    sistema = data.get("sistemaProgresso") or {}
    noites = data.get("noitesCampo") or {}
    justica = data.get("justicaDisciplina") or {}

    parts = [periodo_line]
    parts.append(_sec_title("Determinações"))
    parts.append(_sub_title("Resoluções do Conselho de Agrupamento"))
    parts.append(_render_str_list(det.get("resolucoes") or []))
    parts.append(_sub_title("Determinações do Conselho de Agrupamento"))
    parts.append(_render_str_list(det.get("determinacoes") or []))

    parts.append(_sec_title("Atividades"))
    parts.append(_sub_title("Agrupamento"))
    parts.append(_render_ativ_list(atividades.get("agrupamento") or []))
    parts.append(_sub_title("Unidades"))
    parts.append(_by_section(_render_ativ_list, atividades, sub=True))

    parts.append(
        _sec_title(
            "Criação/Extinção de Unidades, Bandos, Patrulhas, Equipas, Tribos e Departamentos"
        )
    )
    parts.append(_sub_title("Criação"))
    parts.append(_by_section(_render_str_list, criacao_extincao.get("criacao") or {}, sub=True))
    parts.append(_sub_title("Extinção"))
    parts.append(_by_section(_render_str_list, criacao_extincao.get("extincao") or {}, sub=True))

    parts.append(_sec_title("Nomeações e Exonerações"))
    parts.append(_sub_title("Dirigentes"))
    parts.append(_render_nom_list(nomeacoes.get("dirigentes") or []))
    parts.append(_sub_title("Secções"))
    parts.append(_by_section(_render_nom_list, nomeacoes, sub=True))
    parts.append(_sub_title("Departamentos"))
    parts.append(_render_str_list(nomeacoes.get("departamentos") or []))

    parts.append(_sec_title("Efetivo"))
    for sub_key, label in (
        ("admissao", "Admissão de Associados"),
        ("readmissao", "Readmissão de Associados"),
        ("transferencia", "Transferência de Associados"),
        ("passagens", "Passagens de Secção"),
        ("investiduras", "Investiduras"),
    ):
        parts.append(_sub_title(label))
        parts.append(_by_section(_render_str_list, efetivo.get(sub_key) or {}, sub=True))
    parts.append(_sub_title("Saída do Ativo de Associados"))
    saida = efetivo.get("saidaAtivo") or {}
    parts.append(_sub_sub_title("Dirigentes"))
    parts.append(_render_str_list(saida.get("dirigentes") or []))
    for key in SECCOES:
        parts.append(_sub_sub_title(SECCAO_LABELS[key]))
        parts.append(_render_str_list(saida.get(key) or []))

    parts.append(_sec_title("Sistema de Progresso"))
    parts.append(_by_section(_render_str_list, sistema))

    parts.append(_sec_title("Noites de Campo"))
    parts.append(_by_section(_render_noites_list, noites))

    parts.append(_sec_title("Justiça e Disciplina"))
    parts.append(_sub_title("Acções Disciplinares"))
    parts.append(_render_str_list(justica.get("accoesDisicplinares") or []))
    parts.append(_sub_title("Distinções e Prémios"))
    distincoes = (justica.get("distincoesPremios") or "").strip()
    parts.append(
        f'<p style="margin:4px 0 4px 16px;font-style:italic;white-space:pre-wrap;">{distincoes}</p>'
        if distincoes
        else _NADA
    )

    parts.append(_sec_title("Retificações"))
    parts.append(_render_str_list(data.get("retificacoes") or []))

    local_data = data.get("localData") or ""
    chefe = data.get("chefeAgrupamento") or ""
    secretario = data.get("secretarioAgrupamento") or ""
    if local_data or chefe or secretario:
        chefe_block = (
            f'<div><p style="font-size:11px;color:#6b7280;margin:0;">Chefe de Agrupamento</p>'
            f'<p style="font-weight:600;margin:4px 0 0 0;">{chefe}</p></div>'
            if chefe
            else "<div></div>"
        )
        sec_block = (
            f'<div style="text-align:right;"><p style="font-size:11px;color:#6b7280;margin:0;">'
            f'Secretário de Agrupamento</p>'
            f'<p style="font-weight:600;margin:4px 0 0 0;">{secretario}</p></div>'
            if secretario
            else ""
        )
        local_block = f'<p style="margin:0 0 20px 0;">{local_data}</p>' if local_data else ""
        parts.append(
            '<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">'
            f"{local_block}"
            '<div style="display:flex;justify-content:space-between;gap:40px;margin-top:30px;">'
            f"{chefe_block}{sec_block}</div></div>"
        )

    return "".join(parts)
