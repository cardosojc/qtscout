import type { DocumentType } from '@qtscout/types/document'
import { DOCUMENT_TYPE_PREFIXES } from '@qtscout/types/document'

export function formatDocumentIdentifier(type: DocumentType, number: number, year: number | null): string {
  const prefix = DOCUMENT_TYPE_PREFIXES[type]
  const num = number.toString().padStart(3, '0')
  if (type === 'ORDEM_SERVICO') {
    return `${prefix}-${num}`
  }
  return `${prefix}-${num}/${year}`
}
