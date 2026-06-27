import type { OSAtividade, OSNomeacao, OSNoitesMilestone } from '@qtscout/types/ordem-servico'
import { isNightsBadgeCount } from './scout'
import { ORDEM_CATEGORIES } from './ordem-categories.generated'
import { ESPECIALIDADES } from './especialidades.generated'

export const ORDEM_SECTIONS = ['ALCATEIA', 'EXPEDICAO', 'COMUNIDADE', 'CLA'] as const
export type OrdemSection = (typeof ORDEM_SECTIONS)[number]

export const ORDEM_SECTION_LABELS: Record<OrdemSection, string> = {
  ALCATEIA: 'Alcateia',
  EXPEDICAO: 'Expedição',
  COMUNIDADE: 'Comunidade',
  CLA: 'Clã',
}

/**
 * Progress-system stages (etapas) per section. Mirrored in
 * apps/api/app/core/ordem_categories.py (ETAPAS_PROGRESSO) — keep both in sync.
 */
export const ETAPAS_PROGRESSO: Record<OrdemSection, readonly string[]> = {
  ALCATEIA: ['Pata Tenra', 'Lobo Valente', 'Lobo Cortês', 'Lobo Amigo'],
  EXPEDICAO: ['Apelo', 'Aliança', 'Rumo', 'Descoberta'],
  COMUNIDADE: ['Desprendimento', 'Conhecimento', 'Vontade', 'Construção'],
  CLA: ['Caminho', 'Comunidade', 'Serviço', 'Partida'],
}

const ALL_ETAPAS: ReadonlySet<string> = new Set(Object.values(ETAPAS_PROGRESSO).flat())

/**
 * Higher-level insígnias awarded on top of especialidades. Mirrored in
 * apps/api/app/core/especialidades.py (MERITO_ESPECIALISTA) — keep both in sync.
 */
export const MERITO_ESPECIALISTA = ['Mérito', 'Especialista'] as const

export { ESPECIALIDADES }

const ALL_ESPECIALIDADES: ReadonlySet<string> = new Set<string>([
  ...ESPECIALIDADES,
  ...MERITO_ESPECIALISTA,
])

export type ItemShape =
  | 'STRING'
  | 'TEXT'
  | 'ATIVIDADE'
  | 'NOMEACAO'
  | 'NOITES'
  | 'MEMBER_REF'
  | 'NOITES_REF'
  | 'PROFILE_REF'
  | 'SCOUT_OR_PROFILE_REF'
  | 'PROGRESSO_REF'
  | 'NOITES_CAMPO_REF'
  | 'ESPECIALIDADE_REF'

export type ItemScope = 'GROUP' | 'SECTION' | 'BOTH'

export type CategorySpec = {
  key: string
  label: string
  shape: ItemShape
  scope: ItemScope
}

/**
 * Catalog of all item categories. **Single source of truth: the JSON at
 * `apps/api/app/core/ordem_categories.json`** (loaded by the Python backend). This
 * TS copy is generated from it by `npm run sync:categories` (CI guards drift
 * via `npm run sync:categories:check`). Controls shape (form rendering), scope
 * (permission checks), and assembler routing.
 *
 * When adding a category:
 *   1. Edit the JSON, run `npm run sync:categories`.
 *   2. Extend validateItemData() (here) + the Python validator if the shape is new.
 *   3. Add a `case` in the Python assembler (apps/api/app/core/ordem_assembler.py).
 *   4. Run `npm run docs:sync` to refresh `docs/ordem-categories.md`.
 *   5. The form (item-form.tsx) renders from `shape` automatically.
 */
export { ORDEM_CATEGORIES }

export type OrdemCategoryKey = (typeof ORDEM_CATEGORIES)[number]['key']

export const CATEGORY_MAP: Record<OrdemCategoryKey, CategorySpec> = Object.fromEntries(
  ORDEM_CATEGORIES.map((c) => [c.key, c])
) as Record<OrdemCategoryKey, CategorySpec>

export function isOrdemCategoryKey(value: unknown): value is OrdemCategoryKey {
  return typeof value === 'string' && value in CATEGORY_MAP
}

export function isOrdemSection(value: unknown): value is OrdemSection {
  return typeof value === 'string' && (ORDEM_SECTIONS as readonly string[]).includes(value)
}

// ─── Shape-specific data validation ───────────────────────────────────────────

export type StringData = { value: string }
export type ItemValue = StringData | OSAtividade | OSNomeacao | OSNoitesMilestone

export type ValidateResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }

/** Normalise a multi-member ref to a deduped scout-id array, accepting the bulk
 * `scoutIds` array or a legacy single `scoutId`. */
function readScoutIds(d: Record<string, unknown>): string[] {
  const ids = Array.isArray(d.scoutIds)
    ? d.scoutIds.filter((i): i is string => typeof i === 'string' && i !== '')
    : typeof d.scoutId === 'string' && d.scoutId
      ? [d.scoutId]
      : []
  return [...new Set(ids)]
}

export function validateItemData(shape: ItemShape, data: unknown): ValidateResult {
  if (data === null || typeof data !== 'object') {
    return { ok: false, error: 'data deve ser um objeto' }
  }
  const d = data as Record<string, unknown>

  switch (shape) {
    case 'STRING':
    case 'TEXT': {
      if (typeof d.value !== 'string' || d.value.trim() === '') {
        return { ok: false, error: 'value (texto) é obrigatório' }
      }
      return { ok: true, value: { value: d.value.trim() } }
    }
    case 'ATIVIDADE': {
      if (typeof d.nome !== 'string' || d.nome.trim() === '') {
        return { ok: false, error: 'nome é obrigatório' }
      }
      return {
        ok: true,
        value: {
          nome: d.nome.trim(),
          datas: typeof d.datas === 'string' ? d.datas.trim() : '',
          local: typeof d.local === 'string' ? d.local.trim() : '',
        },
      }
    }
    case 'NOMEACAO': {
      if (typeof d.nome !== 'string' || d.nome.trim() === '') {
        return { ok: false, error: 'nome é obrigatório' }
      }
      return {
        ok: true,
        value: {
          nome: d.nome.trim(),
          cargo: typeof d.cargo === 'string' ? d.cargo.trim() : '',
        },
      }
    }
    case 'NOITES': {
      const count = Number(d.count)
      if (!Number.isFinite(count) || count <= 0) {
        return { ok: false, error: 'count deve ser um número positivo' }
      }
      const membros = Array.isArray(d.membros)
        ? d.membros.filter((m): m is string => typeof m === 'string' && m.trim() !== '').map((m) => m.trim())
        : []
      return { ok: true, value: { count: Math.floor(count), membros } }
    }
    case 'MEMBER_REF': {
      if (typeof d.scoutId !== 'string' || !d.scoutId) {
        return { ok: false, error: 'Membro obrigatório' }
      }
      return { ok: true, value: { scoutId: d.scoutId } }
    }
    case 'PROGRESSO_REF': {
      const scoutIds = readScoutIds(d)
      if (scoutIds.length === 0) {
        return { ok: false, error: 'Membro obrigatório' }
      }
      if (typeof d.etapa !== 'string' || !ALL_ETAPAS.has(d.etapa)) {
        return { ok: false, error: 'Etapa obrigatória' }
      }
      return { ok: true, value: { scoutIds, etapa: d.etapa } }
    }
    case 'NOITES_CAMPO_REF': {
      const scoutIds = readScoutIds(d)
      if (scoutIds.length === 0) {
        return { ok: false, error: 'Membro obrigatório' }
      }
      const count = Number(d.count)
      if (!isNightsBadgeCount(count)) {
        return { ok: false, error: 'Número de noites inválido' }
      }
      return { ok: true, value: { scoutIds, count } }
    }
    case 'ESPECIALIDADE_REF': {
      const scoutIds = readScoutIds(d)
      if (scoutIds.length === 0) {
        return { ok: false, error: 'Membro obrigatório' }
      }
      if (typeof d.especialidade !== 'string' || !ALL_ESPECIALIDADES.has(d.especialidade)) {
        return { ok: false, error: 'Especialidade obrigatória' }
      }
      return { ok: true, value: { scoutIds, especialidade: d.especialidade } }
    }
    case 'NOITES_REF': {
      const count = Number(d.count)
      if (!Number.isFinite(count) || count <= 0) {
        return { ok: false, error: 'count deve ser um número positivo' }
      }
      const scoutIds = Array.isArray(d.scoutIds)
        ? d.scoutIds.filter((m): m is string => typeof m === 'string' && m !== '')
        : []
      return { ok: true, value: { count: Math.floor(count), scoutIds } }
    }
    case 'PROFILE_REF': {
      if (typeof d.profileId !== 'string' || !d.profileId) {
        return { ok: false, error: 'Dirigente obrigatório' }
      }
      const cargo = typeof d.cargo === 'string' ? d.cargo.trim() : ''
      return { ok: true, value: { profileId: d.profileId, cargo } }
    }
    case 'SCOUT_OR_PROFILE_REF': {
      const kind = d.kind === 'scout' ? 'scout' : d.kind === 'profile' ? 'profile' : null
      if (!kind) return { ok: false, error: 'Tipo de referência inválido' }
      if (typeof d.refId !== 'string' || !d.refId) {
        return { ok: false, error: 'Referência obrigatória' }
      }
      const cargo = typeof d.cargo === 'string' ? d.cargo.trim() : ''
      return { ok: true, value: { kind, refId: d.refId, cargo } }
    }
  }
}
