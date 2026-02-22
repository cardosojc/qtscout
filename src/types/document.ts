export type DocumentType = 'OFICIO' | 'CIRCULAR' | 'ORDEM_SERVICO'

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  OFICIO: 'Ofício',
  CIRCULAR: 'Circular',
  ORDEM_SERVICO: 'Ordem de Serviço',
}

export const DOCUMENT_TYPE_PREFIXES: Record<DocumentType, string> = {
  OFICIO: 'OF',
  CIRCULAR: 'CI',
  ORDEM_SERVICO: 'OS',
}

export interface Document {
  id: string
  type: DocumentType
  number: number
  year: number | null
  content: string
  identifier: string
  createdAt: string
  updatedAt: string
  createdBy: { name?: string | null; email: string }
}

export interface DocumentSettings {
  type: DocumentType
  startingNumber: number
}
