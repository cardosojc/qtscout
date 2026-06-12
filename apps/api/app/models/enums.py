"""Postgres enum types (created by Prisma). The SQLAlchemy columns bind to the
existing types with create_type=False so no DDL is emitted.
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
