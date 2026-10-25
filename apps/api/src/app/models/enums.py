"""Enum value sets. Stored as plain strings (`str_enum`); D1/SQLite has no enum
types, so the values are only enforced app-side.
"""

from enum import StrEnum


class OrdemSection(StrEnum):
    ALCATEIA = "ALCATEIA"
    EXPEDICAO = "EXPEDICAO"
    COMUNIDADE = "COMUNIDADE"
    CLA = "CLA"


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    LEADER = "LEADER"
    MEMBER = "MEMBER"


class DocumentType(StrEnum):
    OFICIO = "OFICIO"
    CIRCULAR = "CIRCULAR"
    ORDEM_SERVICO = "ORDEM_SERVICO"
