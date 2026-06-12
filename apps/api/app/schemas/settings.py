from pydantic import BaseModel

from app.models.enums import DocumentType


class DocumentSettingItem(BaseModel):
    # camelCase field names mirror the wire format (request + response).
    type: DocumentType
    startingNumber: int  # noqa: N815


class DocumentSettingsBody(BaseModel):
    settings: list[DocumentSettingItem]
