import type { OrdemSection } from '@qtscout/types/ordem-item'

export interface Scout {
  id: string
  firstName: string
  lastName: string
  numeroAssociado: string | null
  dateOfBirth: string
  section: OrdemSection | null
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
  joinedAt: string
  active: boolean
  noitesCampoInicial: number
}

/** Date the manual snapshot refers to (start of the current ano escutista). */
export const NOITES_CAMPO_SNAPSHOT_DATE = '2025-10-01'

/**
 * Total noites de campo for a scout. SIIE's activity history ("Atividades por
 * Elemento", imported) is complete, so its total wins; the manual snapshot is
 * only the fallback for scouts with no imported SIIE data.
 */
export function computeNoitesCampoAtual(
  scout: Pick<Scout, 'noitesCampoInicial'>,
  siieTotal?: number | null,
): number {
  return siieTotal ?? scout.noitesCampoInicial
}

export function scoutDisplayName(s: Pick<Scout, 'firstName' | 'lastName'>): string {
  return `${s.firstName} ${s.lastName}`.trim()
}

export const NIGHTS_BADGE_COUNTS = [25, 50, 75, 100, 200] as const
export type NightsBadgeCount = (typeof NIGHTS_BADGE_COUNTS)[number]

export function isNightsBadgeCount(value: unknown): value is NightsBadgeCount {
  return typeof value === 'number' && (NIGHTS_BADGE_COUNTS as readonly number[]).includes(value)
}

export interface NightsBadge {
  count: NightsBadgeCount
  awardedAt: string
}
