"""Mirrors `@qtscout/core/document-utils` + DOCUMENT_TYPE_PREFIXES, plus the
atomic document numbering shared by documents and ordens de serviço."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import atomic_batch
from app.models import DocumentSettings
from app.models._columns import utcnow
from app.models.enums import DocumentType
from app.models.ids import cuid_id

DOCUMENT_TYPE_PREFIXES: dict[DocumentType, str] = {
    DocumentType.OFICIO: "OF",
    DocumentType.CIRCULAR: "CI",
    DocumentType.ORDEM_SERVICO: "OS",
}


def format_document_identifier(type_: DocumentType, number: int, year: int | None) -> str:
    prefix = DOCUMENT_TYPE_PREFIXES[type_]
    num = str(number).zfill(3)
    if type_ == DocumentType.ORDEM_SERVICO:
        return f"{prefix}-{num}"
    return f"{prefix}-{num}/{year}"


_MAX_IDS_PER_STATEMENT = 90


def db_timestamp(value: datetime) -> str:
    """A naive-UTC datetime in SQLAlchemy's SQLite text format (for raw SQL binds)."""
    return value.strftime("%Y-%m-%d %H:%M:%S.%f")


def create_numbered_document(
    session: Session,
    *,
    type_: DocumentType,
    seq_year: int,
    doc_year: int | None,
    content: str,
    created_by_id: str,
    mark_items: Sequence[str] = (),
) -> str:
    """Take the next number for (type, seq_year) and create the document, atomically.

    One batch: bump the sequence (respecting the configured starting number),
    insert the document with that number, and optionally mark OS source items
    as included. Either all of it lands or none of it does, so numbers are never
    duplicated or skipped by a half-finished request. Returns the new document id.
    """
    starting = session.scalar(
        select(DocumentSettings.starting_number).where(DocumentSettings.type == type_)
    )
    starting = starting or 1
    doc_id = cuid_id()
    now = db_timestamp(utcnow())
    statements: list[tuple[str, Sequence[Any]]] = [
        (
            'INSERT INTO document_sequences (id, type, year, "currentNumber") '
            "VALUES (?, ?, ?, ?) "
            'ON CONFLICT (type, year) DO UPDATE SET "currentNumber" = '
            'MAX(document_sequences."currentNumber" + 1, excluded."currentNumber")',
            (cuid_id(), type_.value, seq_year, starting),
        ),
        (
            'INSERT INTO documents (id, type, number, year, content, "createdAt", '
            '"updatedAt", "createdById") '
            'SELECT ?, ?, "currentNumber", ?, ?, ?, ?, ? FROM document_sequences '
            "WHERE type = ? AND year = ?",
            (
                doc_id,
                type_.value,
                doc_year,
                content,
                now,
                now,
                created_by_id,
                type_.value,
                seq_year,
            ),
        ),
    ]
    # D1 allows at most 100 bound parameters per statement.
    for i in range(0, len(mark_items), _MAX_IDS_PER_STATEMENT):
        chunk = mark_items[i : i + _MAX_IDS_PER_STATEMENT]
        marks = ", ".join("?" for _ in chunk)
        statements.append(
            (
                f'UPDATE ordem_items SET "includedInOsId" = ? WHERE id IN ({marks})',
                (doc_id, *chunk),
            )
        )
    atomic_batch(session, statements)
    return doc_id
