from app.core.ordem_assembler import assemble_ordem_servico
from app.core.ordem_resolver import ResolvedRefs
from app.models import OrdemItem
from app.models.enums import OrdemSection


def test_assemble_routes_items_into_buckets() -> None:
    refs = ResolvedRefs(
        scouts={
            "s1": {"id": "s1", "firstName": "Ana", "lastName": "Silva", "numeroAssociado": "9"}
        },
        profiles={"p1": {"id": "p1", "name": "Chefe", "email": "c@e"}},
    )
    items = [
        OrdemItem(category="RESOLUCAO", section=None, data={"value": "R1"}),
        OrdemItem(category="ATIVIDADE", section=OrdemSection.ALCATEIA, data={"nome": "Camp"}),
        OrdemItem(category="ATIVIDADE", section=None, data={"nome": "AgrupAtiv"}),
        OrdemItem(category="PROGRESSO", section=OrdemSection.CLA, data={"scoutId": "s1"}),
        OrdemItem(
            category="NOMEACAO_DIRIGENTE",
            section=None,
            data={"profileId": "p1", "cargo": "Tesoureiro"},
        ),
        OrdemItem(category="DISTINCAO_PREMIO", section=None, data={"value": "D1"}),
        OrdemItem(category="DISTINCAO_PREMIO", section=None, data={"value": "D2"}),
    ]
    out = assemble_ordem_servico(items, {"de": "2025-10-01", "ate": "2026-09-30"}, refs)

    assert out["periodo"] == {"de": "2025-10-01", "ate": "2026-09-30"}
    assert out["determinacoes"]["resolucoes"] == ["R1"]
    assert out["atividades"]["alcateia"][0]["nome"] == "Camp"
    assert out["atividades"]["agrupamento"][0]["nome"] == "AgrupAtiv"
    assert out["sistemaProgresso"]["cla"] == ["Ana Silva (9)"]
    assert out["nomeacoes"]["dirigentes"] == [{"nome": "Chefe", "cargo": "Tesoureiro"}]
    # DISTINCAO_PREMIO pieces are joined with a blank line.
    assert out["justicaDisciplina"]["distincoesPremios"] == "D1\n\nD2"
