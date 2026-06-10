from datetime import datetime

from app.core.siie_import import (
    category_to_section,
    combine_postal_code,
    map_row,
    parse_excel_date,
    split_name,
)
from app.models.enums import OrdemSection


def test_category_to_section() -> None:
    # Section is derived from the LAST letter of Categoria.
    assert category_to_section("L") == OrdemSection.ALCATEIA
    assert category_to_section("xxE") == OrdemSection.EXPEDICAO
    assert category_to_section("P") == OrdemSection.COMUNIDADE
    assert category_to_section("C") == OrdemSection.CLA
    assert category_to_section("AD") is None  # dirigente (ends in D)
    assert category_to_section(None) is None


def test_split_name() -> None:
    assert split_name("Maria João Silva") == ("Maria", "João Silva")
    assert split_name("Pedro") == ("Pedro", "")
    assert split_name("  ") == ("", "")


def test_parse_excel_date_variants() -> None:
    assert parse_excel_date(datetime(2020, 5, 1)) == datetime(2020, 5, 1)
    assert parse_excel_date("01/05/2020") == datetime(2020, 5, 1)  # DD/MM/YYYY
    assert parse_excel_date("2020-05-01") == datetime(2020, 5, 1)  # ISO
    serial = (datetime(2020, 5, 1) - datetime(1899, 12, 30)).days  # Excel serial
    assert parse_excel_date(serial) == datetime(2020, 5, 1)
    assert parse_excel_date("nonsense") is None
    assert parse_excel_date(None) is None


def test_combine_postal_code() -> None:
    assert combine_postal_code("1900", "123", "Lisboa") == "1900-123 Lisboa"
    assert combine_postal_code("1900", "45", None) == "1900-045"
    assert combine_postal_code("", "", "Porto") == "Porto"
    assert combine_postal_code("", "", "") is None


def test_map_row_requires_name_and_nin() -> None:
    assert map_row({"nome": ""}, 2).error == "Sem nome"
    assert map_row({"nome": "Ana", "nin": None}, 2).error == "Sem NIN — necessário para upsert"
    assert map_row({"nome": "Ana", "nin": "1", "datanascimento": "x"}, 2).error == (
        "Data de nascimento inválida"
    )


def test_map_row_ok() -> None:
    result = map_row(
        {
            "nome": "Ana Maria Costa",
            "nin": "12345",
            "datanascimento": "01/02/2010",
            "Categoria": "ExpE",
            "Situacao": "A",
            "email": " ana@example.com ",
        },
        2,
    )
    assert result.ok
    assert result.nin == "12345"
    assert result.payload is not None
    assert result.payload.first_name == "Ana"
    assert result.payload.last_name == "Maria Costa"
    assert result.payload.section == OrdemSection.EXPEDICAO
    assert result.payload.active is True
    assert result.payload.email == "ana@example.com"
    assert result.payload.date_of_birth == datetime(2010, 2, 1)
