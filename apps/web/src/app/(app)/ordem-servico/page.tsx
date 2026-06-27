'use client'
import { apiFetch } from '@/lib/api-client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ItemForm } from '@/components/ordem-servico/item-form'
import {
  CATEGORY_MAP,
  ORDEM_CATEGORIES,
  ORDEM_SECTIONS,
  ORDEM_SECTION_LABELS,
  type CategorySpec,
  type OrdemSection,
} from '@qtscout/types/ordem-item'

type ItemDTO = {
  id: string
  category: string
  section: OrdemSection | null
  date: string
  data: Record<string, unknown>
  includedInOsId: string | null
  createdAt: string
  createdBy: { id: string; name: string | null; email: string }
}

type ProfileMeta = {
  role: 'ADMIN' | 'LEADER' | 'MEMBER'
  roles: string[]
  section: OrdemSection | null
}

type CategorySummary = { category: string; total: number; included: number }

const GROUP_ROLES = [
  'Chefe de Agrupamento',
  'Chefe de Agrupamento Adjunto',
  'Secretário de Agrupamento',
  'Tesoureiro de Agrupamento',
  'Assistente de Agrupamento',
]
const SECTION_ROLES = ['Chefe de Unidade', 'Chefe de Unidade Adjunto', 'Instrutor']

const ITEMS_PER_PAGE = 20

function summarizeData(category: CategorySpec, data: Record<string, unknown>): string {
  const display = (data?._display ?? {}) as Record<string, unknown>
  // Bulk member refs surface `scouts` (array); legacy single refs surface `scout`.
  const membersLabel =
    Array.isArray(display.scouts) && display.scouts.length > 0
      ? (display.scouts as string[]).join(', ')
      : display.scout
        ? String(display.scout)
        : '—'

  switch (category.shape) {
    case 'STRING':
    case 'TEXT':
      return String(data?.value ?? '')
    case 'ATIVIDADE': {
      const parts = [data?.nome, data?.datas, data?.local].filter(Boolean)
      return parts.join(' — ')
    }
    case 'NOMEACAO': {
      const parts = [data?.nome, data?.cargo].filter(Boolean)
      return parts.join(' — ')
    }
    case 'NOITES': {
      const count = Number(data?.count ?? 0)
      const membros = Array.isArray(data?.membros) ? data.membros.length : 0
      return `${count} noite(s), ${membros} membro(s)`
    }
    case 'MEMBER_REF':
      return String(display.scout ?? '—')
    case 'PROGRESSO_REF': {
      const parts = [data?.etapa, membersLabel].filter(Boolean)
      return parts.join(' — ')
    }
    case 'NOITES_CAMPO_REF': {
      const count = Number(data?.count ?? 0)
      return `${count} Noites de Campo — ${membersLabel}`
    }
    case 'ESPECIALIDADE_REF': {
      const parts = [data?.especialidade, membersLabel].filter(Boolean)
      return parts.join(' — ')
    }
    case 'NOITES_REF': {
      const count = Number(data?.count ?? 0)
      const names = Array.isArray(display.scouts) ? (display.scouts as string[]) : []
      return `${count} noite(s) — ${names.length > 0 ? names.join(', ') : 'sem membros'}`
    }
    case 'PROFILE_REF': {
      const parts = [String(display.profile ?? '—'), data?.cargo].filter(Boolean)
      return parts.join(' — ')
    }
    case 'SCOUT_OR_PROFILE_REF': {
      const parts = [String(display.ref ?? '—'), data?.cargo].filter(Boolean)
      return parts.join(' — ')
    }
  }
}

export default function OrdemServicoPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()

  const [profile, setProfile] = useState<ProfileMeta | null>(null)
  // Per-category counts (drives the group headers + page counts).
  const [summary, setSummary] = useState<CategorySummary[]>([])
  // The currently-loaded page of items for each category (server-paginated).
  const [itemsByCat, setItemsByCat] = useState<Record<string, ItemDTO[]>>({})
  const [loadingCat, setLoadingCat] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [filterIncluded, setFilterIncluded] = useState<'pending' | 'all'>('pending')
  const [filterSection, setFilterSection] = useState<OrdemSection | ''>('')
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set())
  const [pageByType, setPageByType] = useState<Record<string, number>>({})

  const toggleType = (key: string) =>
    setCollapsedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const [adding, setAdding] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const [generating, setGenerating] = useState(false)
  const [genFrom, setGenFrom] = useState('')
  const [genTo, setGenTo] = useState('')

  const importInputRef = useRef<HTMLInputElement>(null)
  const [importSummary, setImportSummary] = useState<
    | {
        total: number
        created: number
        updated: number
        skipped: number
        errors: { row: number; descricao: string; error: string }[]
      }
    | null
  >(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      apiFetch('/api/profile/roles'),
      apiFetch('/api/profile/section'),
    ]).then(async ([rolesRes, sectionRes]) => {
      const rolesData = rolesRes.ok ? await rolesRes.json() : { roles: [] }
      const sectionData = sectionRes.ok ? await sectionRes.json() : { section: null }
      setProfile({
        role: user.role,
        roles: rolesData.roles ?? [],
        section: sectionData.section ?? null,
      })
    })
  }, [user])

  const allowedCategories = useMemo<CategorySpec[]>(() => {
    if (!profile) return []
    if (profile.role === 'ADMIN') return Object.values(CATEGORY_MAP)
    const hasGroup = profile.roles.some((r) => GROUP_ROLES.includes(r))
    const hasSection = profile.roles.some((r) => SECTION_ROLES.includes(r)) && profile.section != null
    return Object.values(CATEGORY_MAP).filter((c) => {
      if (c.scope === 'GROUP') return hasGroup
      if (c.scope === 'SECTION') return hasSection
      return hasGroup || hasSection
    })
  }, [profile])

  const filterParams = useCallback(() => {
    const params = new URLSearchParams()
    if (filterIncluded === 'pending') params.set('included', 'false')
    if (filterSection) params.set('section', filterSection)
    return params
  }, [filterIncluded, filterSection])

  // Counts per category (group headers), ordered by the catalog.
  const groups = useMemo(() => {
    const byKey = new Map(summary.map((s) => [s.category, s]))
    return ORDEM_CATEGORIES.flatMap((c) => {
      const s = byKey.get(c.key)
      return s && s.total > 0 ? [{ category: c, total: s.total, included: s.included }] : []
    })
  }, [summary])

  const fetchCategoryItems = useCallback(
    async (categoryKey: string, page: number) => {
      const params = filterParams()
      params.set('category', categoryKey)
      params.set('limit', String(ITEMS_PER_PAGE))
      params.set('offset', String((page - 1) * ITEMS_PER_PAGE))
      setLoadingCat((prev) => ({ ...prev, [categoryKey]: true }))
      try {
        const res = await apiFetch(`/api/ordem-items?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setItemsByCat((prev) => ({ ...prev, [categoryKey]: data.items ?? [] }))
        }
      } finally {
        setLoadingCat((prev) => ({ ...prev, [categoryKey]: false }))
      }
    },
    [filterParams],
  )

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/ordem-items/summary?${filterParams().toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [filterParams])

  const setTypePage = (key: string, page: number) => {
    setPageByType((prev) => ({ ...prev, [key]: page }))
    fetchCategoryItems(key, page)
  }

  useEffect(() => {
    if (profile) fetchSummary()
  }, [profile, fetchSummary])

  // When the summary changes (filters changed / refreshed), reset to page 1 and
  // load each category's first page.
  useEffect(() => {
    setPageByType({})
    setItemsByCat({})
    for (const s of summary) if (s.total > 0) fetchCategoryItems(s.category, 1)
  }, [summary, fetchCategoryItems])

  const handleCreate = async (payload: {
    category: string
    section: OrdemSection | null
    date: string
    data: Record<string, unknown>
  }) => {
    const res = await apiFetch('/api/ordem-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      showToast('Item adicionado', 'success')
      setAdding(false)
      setSelectedCategory('')
      fetchSummary()
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Erro ao adicionar', 'error')
    }
  }

  const handleDelete = async (item: ItemDTO) => {
    const confirmed = await showConfirm({
      title: 'Eliminar item',
      message: 'Tem a certeza?',
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return
    const res = await apiFetch(`/api/ordem-items/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Item eliminado', 'success')
      fetchSummary()
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Erro ao eliminar', 'error')
    }
  }

  const handleImportActivities = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    startLoading('A importar atividades...')
    try {
      const res = await apiFetch('/api/ordem-items/import-activities', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setImportSummary(data.summary)
        const s = data.summary
        showToast(
          `${s.created} criadas, ${s.updated} atualizadas, ${s.skipped} ignoradas, ${s.errors.length} erros`,
          s.errors.length > 0 ? 'error' : 'success'
        )
        fetchSummary()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao importar', 'error')
      }
    } finally {
      stopLoading()
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    if (!genFrom || !genTo) {
      showToast('Selecione o intervalo de datas', 'error')
      return
    }
    startLoading('A gerar Ordem de Serviço...')
    try {
      const res = await apiFetch('/api/ordens-servico/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: genFrom, to: genTo }),
      })
      if (res.ok) {
        const doc = await res.json()
        const parts = [`${doc.itemCount} itens`]
        if (doc.autoAdmissions) parts.push(`${doc.autoAdmissions} admissões`)
        if (doc.autoNightsBadges) parts.push(`${doc.autoNightsBadges} insígnias`)
        showToast(`Ordem de Serviço ${doc.identifier} criada (${parts.join(', ')})`, 'success')
        setGenerating(false)
        router.push(`/documents/${doc.id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao gerar', 'error')
      }
    } finally {
      stopLoading()
    }
  }

  if (authLoading || !user) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  const canGenerate = profile?.role === 'ADMIN'
  const selected = selectedCategory ? CATEGORY_MAP[selectedCategory as keyof typeof CATEGORY_MAP] : null

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[{ label: 'Ordem de Serviço' }]} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ordem de Serviço</h1>
        {canGenerate && (
          <div className="flex gap-2 flex-wrap">
            <label className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors">
              Importar Atividades (SIIE)
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleImportActivities}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setGenerating(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Gerar Ordem de Serviço
            </button>
          </div>
        )}
      </div>

      {importSummary && (
        <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Resultado da importação
            </h2>
            <button
              onClick={() => setImportSummary(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Fechar
            </button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {importSummary.total} linhas processadas — <strong>{importSummary.created}</strong> criadas,{' '}
            <strong>{importSummary.updated}</strong> atualizadas,{' '}
            <strong>{importSummary.skipped}</strong> ignoradas (já numa OS),{' '}
            <strong>{importSummary.errors.length}</strong> erros.
          </p>
          {importSummary.errors.length > 0 && (
            <ul className="mt-3 text-xs text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
              {importSummary.errors.map((e, i) => (
                <li key={i}>
                  Linha {e.row}{e.descricao ? ` — ${e.descricao}` : ''}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add item */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            disabled={allowedCategories.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Adicionar Item
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Selecione —</option>
                {allowedCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <ItemForm
                category={selected}
                defaultSection={profile?.section ?? null}
                allowSectionPicker={profile?.role === 'ADMIN'}
                onSubmit={handleCreate}
                onCancel={() => {
                  setAdding(false)
                  setSelectedCategory('')
                }}
              />
            )}
          </div>
        )}
        {allowedCategories.length === 0 && profile && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Configure as suas funções e secção em <a href="/profile" className="text-blue-600 hover:underline">Meu Perfil</a> para poder adicionar itens.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <select
          value={filterIncluded}
          onChange={(e) => setFilterIncluded(e.target.value as 'pending' | 'all')}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="pending">Pendentes</option>
          <option value="all">Todos</option>
        </select>
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value as OrdemSection | '')}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">Todas as secções</option>
          {ORDEM_SECTIONS.map((s) => (
            <option key={s} value={s}>{ORDEM_SECTION_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Items list, grouped by type (server-paginated) */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-sm text-gray-500 dark:text-gray-400">
          A carregar...
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Sem itens
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ category, total, included }) => {
            const isCollapsed = collapsedTypes.has(category.key)
            const totalPages = Math.max(Math.ceil(total / ITEMS_PER_PAGE), 1)
            const page = Math.min(Math.max(pageByType[category.key] ?? 1, 1), totalPages)
            const pageItems = itemsByCat[category.key] ?? []
            const catLoading = loadingCat[category.key]
            return (
            <div key={category.key} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleType(category.key)}
                aria-expanded={!isCollapsed}
                className="w-full px-4 py-3 flex items-center gap-2 text-left border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {category.label} <span className="text-xs text-gray-500">({total})</span>
                  {included > 0 && (
                    <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      {included} incluído{included === 1 ? '' : 's'}
                    </span>
                  )}
                </h2>
              </button>
              {!isCollapsed && (
              <>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {catLoading && pageItems.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">A carregar...</div>
                )}
                {pageItems.map((item) => (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {item.section && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {ORDEM_SECTION_LABELS[item.section]}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.date).toLocaleDateString('pt-PT')}
                        </span>
                        {item.includedInOsId && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            incluído
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
                        {summarizeData(category, item.data)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        por {item.createdBy.name || item.createdBy.email}
                      </p>
                    </div>
                    {!item.includedInOsId && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
                  <button
                    type="button"
                    onClick={() => setTypePage(category.key, page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTypePage(category.key, page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Seguinte
                  </button>
                </div>
              )}
              </>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Generate modal */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Gerar Ordem de Serviço
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Selecione o intervalo de datas. Todos os itens pendentes nesse intervalo serão incluídos.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">De</label>
                <input
                  type="date"
                  value={genFrom}
                  onChange={(e) => setGenFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Até</label>
                <input
                  type="date"
                  value={genTo}
                  onChange={(e) => setGenTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setGenerating(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
