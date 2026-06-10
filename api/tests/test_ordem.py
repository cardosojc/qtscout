from app.core.ordem_categories import CATEGORY_MAP, validate_item_data
from app.core.ordem_permissions import ProfileForAuth, can_manage_item, resolve_category


def test_validate_string() -> None:
    assert validate_item_data("STRING", {"value": "  hi "}).value == {"value": "hi"}
    bad = validate_item_data("STRING", {"value": "  "})
    assert not bad.ok and bad.error == "value (texto) é obrigatório"
    assert not validate_item_data("STRING", None).ok


def test_validate_atividade_and_noites() -> None:
    ativ = validate_item_data("ATIVIDADE", {"nome": " Acampamento ", "local": " Sintra "})
    assert ativ.value == {"nome": "Acampamento", "datas": "", "local": "Sintra"}
    noites = validate_item_data("NOITES", {"count": 3.9, "membros": ["A", "", " B "]})
    assert noites.value == {"count": 3, "membros": ["A", "B"]}
    assert not validate_item_data("NOITES", {"count": 0}).ok


def test_validate_refs() -> None:
    assert validate_item_data("MEMBER_REF", {"scoutId": "s1"}).value == {"scoutId": "s1"}
    assert not validate_item_data("MEMBER_REF", {"scoutId": ""}).ok
    spr = validate_item_data("SCOUT_OR_PROFILE_REF", {"kind": "scout", "refId": "x"})
    assert spr.value == {"kind": "scout", "refId": "x", "cargo": ""}
    assert not validate_item_data("SCOUT_OR_PROFILE_REF", {"kind": "nope", "refId": "x"}).ok


def test_resolve_category() -> None:
    assert resolve_category("ATIVIDADE") is CATEGORY_MAP["ATIVIDADE"]
    assert resolve_category("NOPE") is None


def test_permissions() -> None:
    admin = ProfileForAuth(role="ADMIN", roles=[], section=None)
    chefe_unidade = ProfileForAuth(role="LEADER", roles=["Chefe de Unidade"], section="ALCATEIA")
    chefe_agrup = ProfileForAuth(role="LEADER", roles=["Chefe de Agrupamento"], section=None)

    resolucao = CATEGORY_MAP["RESOLUCAO"]  # GROUP
    progresso = CATEGORY_MAP["PROGRESSO"]  # SECTION
    atividade = CATEGORY_MAP["ATIVIDADE"]  # BOTH

    assert can_manage_item(admin, progresso, "CLA")  # admin anything
    assert can_manage_item(chefe_agrup, resolucao, None)
    assert not can_manage_item(chefe_unidade, resolucao, None)  # not group
    assert can_manage_item(chefe_unidade, progresso, "ALCATEIA")  # own section
    assert not can_manage_item(chefe_unidade, progresso, "CLA")  # other section
    assert can_manage_item(chefe_agrup, atividade, "CLA")  # group leader, any section
