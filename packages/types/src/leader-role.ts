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

// "de Agrupamento" roles outrank section-level ones; LEADER_ROLES is preordered by seniority.
export function highestRole(roles: string[]): string | null {
  if (roles.length === 0) return null
  const candidates = roles.filter((r) => r.includes('de Agrupamento'))
  const pool = candidates.length > 0 ? candidates : roles
  for (const r of LEADER_ROLES) {
    if ((pool as string[]).includes(r)) return r
  }
  return pool[0]
}
