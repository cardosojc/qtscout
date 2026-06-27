"""OrdemServicoData snapshot builder. Port of `@qtscout/types/ordem-servico`
(`defaultOrdemServicoData`). The snapshot is stored as JSON on Document.content.
"""

from typing import Any

# OrdemSection value -> snapshot section key.
SECTION_KEY = {
    "ALCATEIA": "alcateia",
    "EXPEDICAO": "expedicao",
    "COMUNIDADE": "comunidade",
    "CLA": "cla",
}


def _empty_seccoes() -> dict[str, list[Any]]:
    return {"alcateia": [], "expedicao": [], "comunidade": [], "cla": []}


def default_ordem_servico_data() -> dict[str, Any]:
    return {
        "periodo": {"de": "", "ate": ""},
        "determinacoes": {"resolucoes": [], "determinacoes": []},
        "atividades": {
            "agrupamento": [],
            "alcateia": [],
            "expedicao": [],
            "comunidade": [],
            "cla": [],
        },
        "criacaoExtincao": {"criacao": _empty_seccoes(), "extincao": _empty_seccoes()},
        "nomeacoes": {
            "dirigentes": [],
            "departamentos": [],
            "alcateia": [],
            "expedicao": [],
            "comunidade": [],
            "cla": [],
        },
        "efetivo": {
            "admissao": _empty_seccoes(),
            "readmissao": _empty_seccoes(),
            "transferencia": _empty_seccoes(),
            "saidaAtivo": {"dirigentes": [], **_empty_seccoes()},
            "passagens": _empty_seccoes(),
            "investiduras": _empty_seccoes(),
        },
        "sistemaProgresso": _empty_seccoes(),
        "especialidades": _empty_seccoes(),
        "noitesCampo": {"alcateia": [], "expedicao": [], "comunidade": [], "cla": []},
        "justicaDisciplina": {"accoesDisicplinares": [], "distincoesPremios": ""},
        "retificacoes": [],
        "localData": "",
        "chefeAgrupamento": "",
        "secretarioAgrupamento": "",
    }
