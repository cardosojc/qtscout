import type { OrdemSection } from '@/types/ordem-item'

export type ActivityRow = {
  idatividade: string | null
  agrupamento: string | null
  descricao: string | null
  local: string | null
  'Data Inicio': unknown
  'Data Fim': unknown
  'Sigla Tipo': string | null
  'Sigla Seccao': string | null
  'Sigla Grupo': string | null
  'Nr Participantes': unknown
}

export type ActivityPayload = {
  externalId: string
  date: Date
  section: OrdemSection | null
  nome: string
  datas: string
  local: string
}

export type ActivityMapResult =
  | { ok: true; payload: ActivityPayload }
  | { ok: false; row: number; descricao: string; error: string }

const LETTER_TO_SECTION: Record<string, OrdemSection> = {
  L: 'ALCATEIA',
  E: 'EXPEDICAO',
  P: 'COMUNIDADE',
  C: 'CLA',
}

export function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
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

function formatDayPT(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

/**
 * Section mapping rule: only a single-letter Sigla Seccao maps to a section.
 * Anything multi-value or empty is treated as Agrupamento-level (section=null).
 */
export function sectionFromSiglaSeccao(value: string | null | undefined): OrdemSection | null {
  if (!value) return null
  const letters = value.split(',').map((s) => s.trim()).filter(Boolean)
  if (letters.length !== 1) return null
  return LETTER_TO_SECTION[letters[0].toUpperCase()] ?? null
}

export function mapActivityRow(row: ActivityRow, rowIndex: number): ActivityMapResult {
  const externalId = typeof row.idatividade === 'string' ? row.idatividade.trim() : ''
  const descricao = typeof row.descricao === 'string' ? row.descricao.trim() : ''
  if (!externalId) return { ok: false, row: rowIndex, descricao, error: 'Sem idatividade' }
  if (!descricao) return { ok: false, row: rowIndex, descricao: '(sem descrição)', error: 'Sem descrição' }

  const start = parseExcelDate(row['Data Inicio'])
  if (!start) return { ok: false, row: rowIndex, descricao, error: 'Data Início inválida' }
  const end = parseExcelDate(row['Data Fim'])

  const datas =
    end && end.getTime() !== start.getTime()
      ? `${formatDayPT(start)} a ${formatDayPT(end)}`
      : formatDayPT(start)

  return {
    ok: true,
    payload: {
      externalId,
      date: start,
      section: sectionFromSiglaSeccao(row['Sigla Seccao']),
      nome: descricao,
      datas,
      local: typeof row.local === 'string' ? row.local.trim() : '',
    },
  }
}
