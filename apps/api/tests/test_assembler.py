from app.core.ordem_assembler import add_noites_member, assemble_ordem_servico
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
        OrdemItem(
            category="PROGRESSO",
            section=OrdemSection.CLA,
            data={"scoutId": "s1", "etapa": "Caminho"},
        ),
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
    assert out["sistemaProgresso"]["cla"] == [{"nome": "Ana Silva (9)", "etapa": "Caminho"}]
    assert out["nomeacoes"]["dirigentes"] == [{"nome": "Chefe", "cargo": "Tesoureiro"}]
    # DISTINCAO_PREMIO pieces are joined with a blank line.
    assert out["justicaDisciplina"]["distincoesPremios"] == "D1\n\nD2"


def test_noites_campo_items_merge_by_count() -> None:
    refs = ResolvedRefs(
        scouts={
            "s1": {"id": "s1", "firstName": "Ana", "lastName": "Silva", "numeroAssociado": "9"},
            "s2": {"id": "s2", "firstName": "Rui", "lastName": "Lopes", "numeroAssociado": "7"},
        },
        profiles={},
    )
    alcateia = OrdemSection.ALCATEIA
    items = [
        OrdemItem(category="NOITES_CAMPO", section=alcateia, data={"scoutId": "s1", "count": 50}),
        OrdemItem(category="NOITES_CAMPO", section=alcateia, data={"scoutId": "s2", "count": 50}),
        OrdemItem(category="NOITES_CAMPO", section=alcateia, data={"scoutId": "s1", "count": 25}),
    ]
    out = assemble_ordem_servico(items, {"de": "2025-10-01", "ate": "2026-09-30"}, refs)

    # Same count → one bucket with both members; buckets sorted ascending by count.
    assert out["noitesCampo"]["alcateia"] == [
        {"count": 25, "membros": ["Ana Silva (9)"]},
        {"count": 50, "membros": ["Ana Silva (9)", "Rui Lopes (7)"]},
    ]


def test_bulk_multi_member_items_expand_per_member() -> None:
    refs = ResolvedRefs(
        scouts={
            "s1": {"id": "s1", "firstName": "Ana", "lastName": "Silva", "numeroAssociado": "9"},
            "s2": {"id": "s2", "firstName": "Rui", "lastName": "Lopes", "numeroAssociado": "7"},
        },
        profiles={},
    )
    cla = OrdemSection.CLA
    both = ["s1", "s2"]
    items = [
        OrdemItem(category="PROGRESSO", section=cla, data={"scoutIds": both, "etapa": "Caminho"}),
        OrdemItem(
            category="ESPECIALIDADE",
            section=cla,
            data={"scoutIds": both, "especialidade": "Astrónomo"},
        ),
        OrdemItem(category="NOITES_CAMPO", section=cla, data={"scoutIds": both, "count": 25}),
    ]
    out = assemble_ordem_servico(items, {"de": "2025-10-01", "ate": "2026-09-30"}, refs)

    assert out["sistemaProgresso"]["cla"] == [
        {"nome": "Ana Silva (9)", "etapa": "Caminho"},
        {"nome": "Rui Lopes (7)", "etapa": "Caminho"},
    ]
    assert out["especialidades"]["cla"] == [
        {"nome": "Ana Silva (9)", "especialidade": "Astrónomo"},
        {"nome": "Rui Lopes (7)", "especialidade": "Astrónomo"},
    ]
    # Both members land in the same count bucket.
    assert out["noitesCampo"]["cla"] == [
        {"count": 25, "membros": ["Ana Silva (9)", "Rui Lopes (7)"]}
    ]


def test_add_noites_member_dedupes() -> None:
    buckets: list[dict] = []
    add_noites_member(buckets, 25, "Ana Silva (9)")
    add_noites_member(buckets, 25, "Ana Silva (9)")  # duplicate (manual + auto badge)
    add_noites_member(buckets, 25, "Rui Lopes (7)")
    assert buckets == [{"count": 25, "membros": ["Ana Silva (9)", "Rui Lopes (7)"]}]
