import type { OSAtividade, OSNomeacao, OSNoitesMilestone } from '@/types/ordem-servico'

export const ORDEM_SECTIONS = ['ALCATEIA', 'EXPEDICAO', 'COMUNIDADE', 'CLA'] as const
export type OrdemSection = (typeof ORDEM_SECTIONS)[number]

export const ORDEM_SECTION_LABELS: Record<OrdemSection, string> = {
  ALCATEIA: 'Alcateia',
  EXPEDICAO: 'Expedição',
  COMUNIDADE: 'Comunidade',
  CLA: 'Clã',
}

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

export type ItemScope = 'GROUP' | 'SECTION' | 'BOTH'

export type CategorySpec = {
  key: string
  label: string
  shape: ItemShape
  scope: ItemScope
}

/**
 * Catalog of all item categories. Keys map 1:1 to the assembled OrdemServicoData
 * structure (see ordem-servico.ts).
 */
export const ORDEM_CATEGORIES = [
  // Determinações (group)
  { key: 'RESOLUCAO', label: 'Resolução do Conselho de Agrupamento', shape: 'STRING', scope: 'GROUP' },
  { key: 'DETERMINACAO', label: 'Determinação do Conselho de Agrupamento', shape: 'STRING', scope: 'GROUP' },

  // Atividades — target picker decides if it's an Agrupamento or Secção activity
  { key: 'ATIVIDADE', label: 'Atividade', shape: 'ATIVIDADE', scope: 'BOTH' },

  // Criação / Extinção (separate categories)
  { key: 'CRIACAO', label: 'Criação (bando/patrulha/equipa/tribo)', shape: 'STRING', scope: 'SECTION' },
  { key: 'EXTINCAO', label: 'Extinção (bando/patrulha/equipa/tribo)', shape: 'STRING', scope: 'SECTION' },

  // Nomeações e Exonerações
  { key: 'NOMEACAO_DIRIGENTE', label: 'Nomeação/Exoneração de Dirigente', shape: 'PROFILE_REF', scope: 'GROUP' },
  { key: 'NOMEACAO_SECCAO', label: 'Nomeação/Exoneração na Secção', shape: 'SCOUT_OR_PROFILE_REF', scope: 'SECTION' },
  { key: 'NOMEACAO_DEPARTAMENTO', label: 'Nomeação/Exoneração em Departamento', shape: 'STRING', scope: 'GROUP' },

  // Efetivo (section-scoped). ADMISSAO is auto-included from Scout.joinedAt at
  // generation time, so it's intentionally not an option in the manual catalog.
  { key: 'READMISSAO', label: 'Readmissão de Associado', shape: 'MEMBER_REF', scope: 'SECTION' },
  { key: 'TRANSFERENCIA', label: 'Transferência de Associado', shape: 'MEMBER_REF', scope: 'SECTION' },
  { key: 'PASSAGEM', label: 'Passagem de Secção', shape: 'MEMBER_REF', scope: 'SECTION' },
  { key: 'INVESTIDURA', label: 'Investidura', shape: 'MEMBER_REF', scope: 'SECTION' },
  { key: 'SAIDA_ATIVO_SECCAO', label: 'Saída do Ativo (Secção)', shape: 'MEMBER_REF', scope: 'SECTION' },
  { key: 'SAIDA_ATIVO_DIRIGENTE', label: 'Saída do Ativo (Dirigente)', shape: 'STRING', scope: 'GROUP' },

  // Sistema de Progresso
  { key: 'PROGRESSO', label: 'Sistema de Progresso', shape: 'MEMBER_REF', scope: 'SECTION' },

  // Noites de Campo
  { key: 'NOITES_CAMPO', label: 'Noites de Campo', shape: 'NOITES_REF', scope: 'SECTION' },

  // Justiça e Disciplina (group)
  { key: 'ACCAO_DISCIPLINAR', label: 'Ação Disciplinar', shape: 'STRING', scope: 'GROUP' },
  { key: 'DISTINCAO_PREMIO', label: 'Distinção ou Prémio', shape: 'TEXT', scope: 'GROUP' },

  // Retificações (group)
  { key: 'RETIFICACAO', label: 'Retificação', shape: 'STRING', scope: 'GROUP' },
] as const satisfies readonly CategorySpec[]

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
