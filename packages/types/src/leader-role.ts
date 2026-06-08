export const LEADER_ROLES = [
  'Chefe de Agrupamento',
  'Chefe de Agrupamento Adjunto',
  'Secretário de Agrupamento',
  'Tesoureiro de Agrupamento',
  'Assistente de Agrupamento',
  'Chefe de Unidade',
  'Chefe de Unidade Adjunto',
  'Instrutor',
] as const

export type LeaderRole = (typeof LEADER_ROLES)[number]

export function isLeaderRole(value: unknown): value is LeaderRole {
  return typeof value === 'string' && (LEADER_ROLES as readonly string[]).includes(value)
}
