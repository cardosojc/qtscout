"""Mirrors `@qtscout/core/document-utils` + DOCUMENT_TYPE_PREFIXES."""

from app.models.enums import DocumentType

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
