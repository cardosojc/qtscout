'use client'
import { apiFetch } from '@/lib/api-client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ORDEM_SECTIONS, ORDEM_SECTION_LABELS, type OrdemSection } from '@qtscout/types/ordem-item'
import { scoutDisplayName, type Scout } from '@qtscout/types/scout'
import { useScouts } from '@/lib/api-hooks'

// Stable empty fallback so the `grouped` useMemo below doesn't re-run on every
// render while SWR data is still undefined.
const NO_SCOUTS: Scout[] = []

type ImportSummary = {
  total: number
  created: number
  updated: number
  linkedToProfile: number
  errors: { row: number; nome: string; error: string }[]
}

export default function MembrosPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filterSection, setFilterSection] = useState<OrdemSection | ''>('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // SWR caches by URL: changing section/inactive filters back and forth is
  // instant, and revisiting the page renders from cache while revalidating.
  const { data, isLoading, mutate } = useScouts(
    { section: filterSection, includeInactive },
    !!user,
  )
  const scouts = data?.scouts ?? NO_SCOUTS
  const loading = isLoading

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    startLoading('A importar membros...')
    try {
      const res = await apiFetch('/api/scouts/import', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setImportSummary(data.summary as ImportSummary)
        const s = data.summary
        showToast(
          `${s.created} criados, ${s.updated} atualizados, ${s.errors.length} erros`,
          s.errors.length > 0 ? 'error' : 'success'
        )
        mutate()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao importar', 'error')
      }
    } finally {
      stopLoading()
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (scout: Scout) => {
    const confirmed = await showConfirm({
      title: 'Eliminar membro',
      message: `Tem a certeza que deseja eliminar ${scoutDisplayName(scout)}?`,
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return
    const res = await apiFetch(`/api/scouts/${scout.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Membro eliminado', 'success')
      mutate()
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || 'Erro ao eliminar', 'error')
    }
  }

  const grouped = useMemo(() => {
    const map: Record<OrdemSection | 'NONE', Scout[]> = {
      ALCATEIA: [], EXPEDICAO: [], COMUNIDADE: [], CLA: [], NONE: [],
    }
    for (const s of scouts) {
      if (s.section) map[s.section].push(s)
      else map.NONE.push(s)
    }
    return map
  }, [scouts])

  if (authLoading || !user) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[{ label: 'Membros' }]} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Membros</h1>
        {user.role === 'ADMIN' && (
          <div className="flex gap-2 flex-wrap">
            <label className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
              Importar de SIIE
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <Link
              href="/membros/novo"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Novo Membro
            </Link>
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
            {importSummary.total} linhas processadas — <strong>{importSummary.created}</strong> criados,{' '}
            <strong>{importSummary.updated}</strong> atualizados,{' '}
            <strong>{importSummary.linkedToProfile}</strong> ligados a perfil existente,{' '}
            <strong>{importSummary.errors.length}</strong> erros.
          </p>
          {importSummary.errors.length > 0 && (
            <ul className="mt-3 text-xs text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
              {importSummary.errors.map((e, i) => (
                <li key={i}>
                  Linha {e.row}{e.nome ? ` — ${e.nome}` : ''}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center text-sm">
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value as OrdemSection | '')}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        >
          <option value="">Todas as secções</option>
          {ORDEM_SECTIONS.map((s) => (
            <option key={s} value={s}>{ORDEM_SECTION_LABELS[s]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-4 h-4"
          />
          Incluir inativos
        </label>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">A carregar...</div>
      ) : scouts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Sem membros registados.
        </div>
      ) : (
        <div className="space-y-6">
          {(filterSection ? [filterSection] : [...ORDEM_SECTIONS, 'NONE' as const]).map((s) => {
            const list = grouped[s] ?? []
            if (list.length === 0) return null
            const label = s === 'NONE' ? 'Sem secção (dirigentes / não atribuídos)' : ORDEM_SECTION_LABELS[s]
            return (
              <div key={s} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {label} <span className="text-xs text-gray-500">({list.length})</span>
                  </h2>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {list.map((scout) => (
                    <li key={scout.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/membros/${scout.id}`}
                          className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {scoutDisplayName(scout)}
                          {!scout.active && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(inativo)</span>
                          )}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {scout.numeroAssociado && <>Nº {scout.numeroAssociado} · </>}
                          Nascido em {new Date(scout.dateOfBirth).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      {user.role === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(scout)}
                          className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          Eliminar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
