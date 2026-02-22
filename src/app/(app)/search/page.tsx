'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/types/document'
import { getCurrentAnoEscutista } from '@/lib/ano-escutista'

type Source = 'all' | 'meetings' | 'documents'

interface MeetingResult {
  id: string
  identifier: string
  date: string
  startTime?: string
  endTime?: string
  location?: string
  content: string
  snippet?: string
  rank?: number
  meetingType: { name: string; code: string }
  createdBy: { name?: string | null; email: string }
}

interface DocumentResult {
  id: string
  type: DocumentType
  number: number
  year: number | null
  content: string
  identifier: string
  createdAt: string
  createdBy: { name?: string | null; email: string }
}

const ALL_DOC_TYPES: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']

function stripContent(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('{')) {
    // JSON (Ordem de Serviço) — extract string values
    const values: string[] = []
    const regex = /:\s*"([^"\\]{2,})"/g
    let m
    while ((m = regex.exec(content)) !== null) {
      if (m[1].trim()) values.push(m[1])
    }
    return values.join(' ')
  }
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function makeSnippet(content: string, query: string): string {
  const text = stripContent(content)
  if (!text) return ''
  if (!query.trim()) return text.substring(0, 200) + (text.length > 200 ? '…' : '')
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim())
  if (idx === -1) return text.substring(0, 200) + (text.length > 200 ? '…' : '')
  const start = Math.max(0, idx - 80)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '')
}

function highlightQuery(text: string, query: string) {
  if (!query.trim()) return text
  const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(
    new RegExp(`(${safe})`, 'gi'),
    '<mark class="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100 rounded-sm px-0.5">$1</mark>'
  )
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SearchPage() {
  const { user: session } = useAuth()
  const router = useRouter()

  const [source, setSource] = useState<Source>('all')
  const [query, setQuery] = useState('')
  const [meetingTypeId, setMeetingTypeId] = useState('')
  const [documentType, setDocumentType] = useState('')
  const ae = getCurrentAnoEscutista()
  const [dateFrom, setDateFrom] = useState(ae.from)
  const [dateTo, setDateTo] = useState(ae.to)
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'identifier'>('relevance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [meetingResults, setMeetingResults] = useState<MeetingResult[]>([])
  const [documentResults, setDocumentResults] = useState<DocumentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [meetingTypes, setMeetingTypes] = useState<{ id: string; name: string; code: string }[]>([])

  useEffect(() => {
    if (session) {
      fetch('/api/meeting-types')
        .then((r) => r.ok ? r.json() : [])
        .then(setMeetingTypes)
        .catch(() => {})
    }
  }, [session])

  // Clear type filters and results when switching source
  useEffect(() => {
    setMeetingTypeId('')
    setDocumentType('')
    setMeetingResults([])
    setDocumentResults([])
    setHasSearched(false)
  }, [source])

  const hasActiveFilter = query || meetingTypeId || documentType || dateFrom || dateTo

  const executeSearch = useCallback(async (opts: {
    source: Source; query: string; meetingTypeId: string; documentType: string
    dateFrom: string; dateTo: string; sortBy: string; sortOrder: string
  }) => {
    if (!session) return
    if (!opts.query && !opts.meetingTypeId && !opts.documentType && !opts.dateFrom && !opts.dateTo) return

    setLoading(true)
    setHasSearched(true)

    const base = new URLSearchParams()
    if (opts.query) base.set('q', opts.query)
    if (opts.dateFrom) base.set('from', opts.dateFrom)
    if (opts.dateTo) base.set('to', opts.dateTo)
    base.set('sortBy', opts.sortBy)
    base.set('sortOrder', opts.sortOrder)

    try {
      const fetchMeetings = async () => {
        if (opts.source === 'documents') return []
        const p = new URLSearchParams(base)
        if (opts.meetingTypeId) p.set('type', opts.meetingTypeId)
        const r = await fetch(`/api/search/meetings?${p}`)
        return r.ok ? r.json() : []
      }

      const fetchDocuments = async () => {
        if (opts.source === 'meetings') return []
        const p = new URLSearchParams(base)
        if (opts.documentType) p.set('type', opts.documentType)
        // documents API doesn't support 'relevance' sort
        if (opts.sortBy === 'relevance') p.set('sortBy', 'date')
        const r = await fetch(`/api/search/documents?${p}`)
        return r.ok ? r.json() : []
      }

      const [meetings, docs] = await Promise.all([fetchMeetings(), fetchDocuments()])
      setMeetingResults(Array.isArray(meetings) ? meetings : [])
      setDocumentResults(Array.isArray(docs) ? docs : [])
    } catch {
      setMeetingResults([])
      setDocumentResults([])
    } finally {
      setLoading(false)
    }
  }, [session])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      executeSearch({ source, query, meetingTypeId, documentType, dateFrom, dateTo, sortBy, sortOrder })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    executeSearch({ source, query, meetingTypeId, documentType, dateFrom, dateTo, sortBy, sortOrder })
  }

  const handleClear = () => {
    setQuery('')
    setMeetingTypeId('')
    setDocumentType('')
    setDateFrom('')
    setDateTo('')
    setSortBy('relevance')
    setSortOrder('desc')
    setMeetingResults([])
    setDocumentResults([])
    setHasSearched(false)
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p>Precisa fazer login para pesquisar.</p>
      </div>
    )
  }

  const totalResults = meetingResults.length + documentResults.length

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Pesquisar</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        {/* Source tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit mb-6">
          {([['all', 'Tudo'], ['meetings', 'Reuniões'], ['documents', 'Documentos']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSource(val)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                source === val
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          {/* Query + type filter row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Pesquisar por texto
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar no conteúdo..."
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              />
            </div>

            {source === 'meetings' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipo de Reunião
                </label>
                <select
                  value={meetingTypeId}
                  onChange={(e) => setMeetingTypeId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
                >
                  <option value="">Todos os tipos</option>
                  {meetingTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {source === 'documents' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipo de Documento
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
                >
                  <option value="">Todos os tipos</option>
                  {ALL_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date + sort row */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Data inicial
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Data final
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ordenar por
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              >
                <option value="relevance">Relevância</option>
                <option value="date">Data</option>
                <option value="identifier">Identificador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ordem
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !hasActiveFilter}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'A pesquisar…' : 'Pesquisar'}
            </button>
            {hasSearched && (
              <button
                type="button"
                onClick={handleClear}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results */}
      <div aria-live="polite" aria-atomic="true">
        {loading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400" role="status">
            A pesquisar…
          </div>
        )}

        {!loading && hasSearched && totalResults === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nenhum resultado encontrado.</p>
          </div>
        )}

        {!loading && totalResults > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalResults} resultado{totalResults !== 1 ? 's' : ''}
            </p>

            {/* Meetings section */}
            {meetingResults.length > 0 && (
              <section>
                {source === 'all' && (
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Reuniões ({meetingResults.length})
                  </h2>
                )}
                <div className="space-y-3">
                  {meetingResults.map((m) => {
                    const snippet = m.snippet
                      ? m.snippet
                      : highlightQuery(makeSnippet(m.content, query), query)
                    return (
                      <div
                        key={m.id}
                        onClick={() => router.push(`/meetings/${m.id}`)}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                              {m.identifier}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {m.meetingType.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(m.date)}
                            </span>
                            {m.location && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {m.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {snippet && (
                          <p
                            className="text-sm text-gray-700 dark:text-gray-300 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:dark:text-yellow-100 [&_mark]:rounded-sm [&_mark]:px-0.5"
                            dangerouslySetInnerHTML={{ __html: snippet }}
                          />
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {m.createdBy.name || m.createdBy.email}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Documents section */}
            {documentResults.length > 0 && (
              <section>
                {source === 'all' && (
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Documentos ({documentResults.length})
                  </h2>
                )}
                <div className="space-y-3">
                  {documentResults.map((doc) => {
                    const snippet = highlightQuery(makeSnippet(doc.content, query), query)
                    return (
                      <div
                        key={doc.id}
                        onClick={() => router.push(`/documents/${doc.id}`)}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap mb-2">
                          <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                            {doc.identifier}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {DOCUMENT_TYPE_LABELS[doc.type]}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(doc.createdAt)}
                          </span>
                        </div>
                        {snippet && (
                          <p
                            className="text-sm text-gray-700 dark:text-gray-300 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:dark:text-yellow-100 [&_mark]:rounded-sm [&_mark]:px-0.5"
                            dangerouslySetInnerHTML={{ __html: snippet }}
                          />
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {doc.createdBy.name || doc.createdBy.email}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
