import type { OrdemSection } from '@/types/ordem-item'

export const EXPECTED_HEADERS = [
  'agrupamento', 'nin', 'nome', 'datanascimento', 'dataadmissao', 'Sexo',
  'Situacao', 'Categoria', 'morada', 'localidade', 'telefone', 'CP 1', 'CP 2',
  'codigopostal', 'telemovel', 'email', 'pai', 'Telefone Pai', 'Email Pai',
  'mae', 'Telefone Mae', 'Email Mae', 'Enc Educ', 'Enc Educ Telefone',
  'Enc Educ Email', 'nif', 'cc',
] as const

export function categoryToSection(categoria: string | null | undefined): OrdemSection | null {
  if (!categoria) return null
  const last = categoria.trim().slice(-1).toUpperCase()
  switch (last) {
    case 'L': return 'ALCATEIA'
    case 'E': return 'EXPEDICAO'
    case 'P': return 'COMUNIDADE'
    case 'C': return 'CLA'
    default: return null // D, AD, ND, DH and anything unknown
  }
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const cleaned = full.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { firstName: '', lastName: '' }
  const parts = cleaned.split(' ')
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * Parses values like:
 *  - JS Date instance (when xlsx is read with cellDates:true)
 *  - "DD/MM/YYYY" string
 *  - "YYYY-MM-DD" ISO string
 *  - Excel date serial number
 */
export function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial: days since 1899-12-30 (sheetjs default)
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    // DD/MM/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
      const [, dd, mm, yyyy] = m
      const d = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)))
      return isNaN(d.getTime()) ? null : d
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function combinePostalCode(cp1: unknown, cp2: unknown, locality: unknown): string | null {
  const code = `${String(cp1 ?? '').trim()}-${String(cp2 ?? '').trim().padStart(3, '0')}`.trim()
  const hasCode = code !== '-' && code !== '-000'
  const loc = typeof locality === 'string' ? locality.trim() : ''
  if (!hasCode && !loc) return null
  if (hasCode && loc) return `${code} ${loc}`
  return hasCode ? code : loc
}

export type ImportRow = {
  agrupamento: string | null
  nin: string | null
  nome: string
  datanascimento: unknown
  dataadmissao: unknown
  Sexo: string | null
  Situacao: string | null
  Categoria: string | null
  morada: string | null
  localidade: string | null
  telefone: string | null
  'CP 1': unknown
  'CP 2': unknown
  codigopostal: string | null
  telemovel: string | null
  email: string | null
  pai: string | null
  'Telefone Pai': string | null
  'Email Pai': string | null
  mae: string | null
  'Telefone Mae': string | null
  'Email Mae': string | null
  'Enc Educ': string | null
  'Enc Educ Telefone': string | null
  'Enc Educ Email': string | null
  nif: string | null
  cc: string | null
}

export type ScoutImportPayload = {
  firstName: string
  lastName: string
  numeroAssociado: string | null
  dateOfBirth: Date
  joinedAt: Date | null
  section: OrdemSection | null
  active: boolean
  sexo: string | null
  cc: string | null
  nif: string | null
  email: string | null
  telefone: string | null
  telemovel: string | null
  morada: string | null
  localidade: string | null
  codigoPostal: string | null
  paiNome: string | null
  paiTelefone: string | null
  paiEmail: string | null
  maeNome: string | null
  maeTelefone: string | null
  maeEmail: string | null
  encarregadoNome: string | null
  encarregadoTelefone: string | null
  encarregadoEmail: string | null
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== 'string') {
    if (v == null || v === '') return null
    return String(v).trim() || null
  }
  const t = v.trim()
  return t || null
}

export type MappedRow =
  | { ok: true; nin: string; payload: ScoutImportPayload; categoria: string | null }
  | { ok: false; row: number; nome: string; error: string }

export function mapRow(row: ImportRow, rowIndex: number): MappedRow {
  const nome = typeof row.nome === 'string' ? row.nome.trim() : ''
  if (!nome) return { ok: false, row: rowIndex, nome: '', error: 'Sem nome' }

  const nin = cleanStr(row.nin)
  if (!nin) return { ok: false, row: rowIndex, nome, error: 'Sem NIN — necessário para upsert' }

  const dateOfBirth = parseExcelDate(row.datanascimento)
  if (!dateOfBirth) return { ok: false, row: rowIndex, nome, error: 'Data de nascimento inválida' }

  const joinedAt = parseExcelDate(row.dataadmissao)
  const { firstName, lastName } = splitName(nome)
  const section = categoryToSection(row.Categoria)
  const active = (cleanStr(row.Situacao) ?? '').toUpperCase() === 'A'

  return {
    ok: true,
    nin,
    categoria: cleanStr(row.Categoria),
    payload: {
      firstName,
      lastName,
      numeroAssociado: nin,
      dateOfBirth,
      joinedAt,
      section,
      active,
      sexo: cleanStr(row.Sexo),
      cc: cleanStr(row.cc),
      nif: cleanStr(row.nif),
      email: cleanStr(row.email),
      telefone: cleanStr(row.telefone),
      telemovel: cleanStr(row.telemovel),
      morada: cleanStr(row.morada),
      localidade: cleanStr(row.localidade),
      codigoPostal: combinePostalCode(row['CP 1'], row['CP 2'], row.codigopostal),
      paiNome: cleanStr(row.pai),
      paiTelefone: cleanStr(row['Telefone Pai']),
      paiEmail: cleanStr(row['Email Pai']),
      maeNome: cleanStr(row.mae),
      maeTelefone: cleanStr(row['Telefone Mae']),
      maeEmail: cleanStr(row['Email Mae']),
      encarregadoNome: cleanStr(row['Enc Educ']),
      encarregadoTelefone: cleanStr(row['Enc Educ Telefone']),
      encarregadoEmail: cleanStr(row['Enc Educ Email']),
    },
  }
}
