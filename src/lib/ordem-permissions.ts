import type { OrdemSection as DbOrdemSection } from '@prisma/client'
import type { LeaderRole } from '@/types/leader-role'
import type { CategorySpec, OrdemSection } from '@/types/ordem-item'
import { CATEGORY_MAP, isOrdemCategoryKey } from '@/types/ordem-item'

const GROUP_ROLES: LeaderRole[] = [
  'Chefe de Agrupamento',
  'Chefe de Agrupamento Adjunto',
  'Secretário de Agrupamento',
  'Tesoureiro de Agrupamento',
  'Assistente de Agrupamento',
]

const SECTION_ROLES: LeaderRole[] = [
  'Chefe de Unidade',
  'Chefe de Unidade Adjunto',
  'Instrutor',
]

export type ProfileForAuth = {
  role: 'ADMIN' | 'LEADER' | 'MEMBER'
  roles: string[]
  section: DbOrdemSection | OrdemSection | null
}

export function hasGroupRole(profile: ProfileForAuth): boolean {
  return profile.roles.some((r) => (GROUP_ROLES as string[]).includes(r))
}

export function hasSectionRole(profile: ProfileForAuth): boolean {
  return profile.roles.some((r) => (SECTION_ROLES as string[]).includes(r))
}

/**
 * Whether `profile` can create/update items for `category` (+ section).
 * Admins can do anything. Section items require the user to belong to that section
 * AND hold a section-level role. Group items require a group-level role.
 */
export function canManageItem(
  profile: ProfileForAuth,
  category: CategorySpec,
  section: OrdemSection | null
): boolean {
  if (profile.role === 'ADMIN') return true

  if (category.scope === 'GROUP') {
    return hasGroupRole(profile)
  }

  // SECTION-scoped
  if (!section) return false
  if (!hasSectionRole(profile)) return false
  return profile.section === section
}

/**
 * Categories this profile can log. Admins get all; others get the subset
 * matching their roles.
 */
export function allowedCategoriesFor(profile: ProfileForAuth): CategorySpec[] {
  if (profile.role === 'ADMIN') return Object.values(CATEGORY_MAP)
  const hasGroup = hasGroupRole(profile)
  const hasSection = hasSectionRole(profile)
  return Object.values(CATEGORY_MAP).filter((c) =>
    c.scope === 'GROUP' ? hasGroup : hasSection && profile.section != null
  )
}

export function resolveCategory(key: string) {
  if (!isOrdemCategoryKey(key)) return null
  return CATEGORY_MAP[key]
}
