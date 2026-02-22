import type { DocumentType } from '@/types/document'
import { DOCUMENT_TYPE_PREFIXES } from '@/types/document'

export function formatDocumentIdentifier(type: DocumentType, number: number, year: number | null): string {
  const prefix = DOCUMENT_TYPE_PREFIXES[type]
  const num = number.toString().padStart(3, '0')
  if (type === 'ORDEM_SERVICO') {
    return `${prefix}-${num}`
  }
  return `${prefix}-${num}/${year}`
}
