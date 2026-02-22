'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import Link from 'next/link'

interface SearchResult {
  id: string
  identifier: string
  date: string
  startTime?: string
  endTime?: string
  location?: string
  content: string
  snippet?: string
  rank?: number
  meetingType: {
    name: string
    code: string
  }
  createdBy: {
    name?: string
    email: string
  }
}

interface SearchFilters {
  query: string
  meetingType: string
  dateFrom: string
  dateTo: string
  sortBy: 'relevance' | 'date' | 'identifier'
  sortOrder: 'asc' | 'desc'
}

export default function SearchPage() {
  const { user: session } = useAuth()
  const router = useRouter()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [meetingTypes, setMeetingTypes] = useState<{ id: string; name: string; code: string }[]>([])

  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    meetingType: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'relevance',
    sortOrder: 'desc'
  })

  useEffect(() => {
    if (session) {
      fetchMeetingTypes()
    }
  }, [session])

  const fetchMeetingTypes = async () => {
    try {
      const response = await fetch('/api/meeting-types')
      if (response.ok) {
        const types = await response.json()
        setMeetingTypes(types)
      }
    } catch (error) {
      console.error('Error fetching meeting types:', error)
    }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const executeSearch = useCallback(async (currentFilters: SearchFilters) => {
    if (!session) return
    if (!currentFilters.query && !currentFilters.meetingType && !currentFilters.dateFrom && !currentFilters.dateTo) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (currentFilters.query) params.append('q', currentFilters.query)
      if (currentFilters.meetingType) params.append('type', currentFilters.meetingType)
      if (currentFilters.dateFrom) params.append('from', currentFilters.dateFrom)
      if (currentFilters.dateTo) params.append('to', currentFilters.dateTo)
      params.append('sortBy', currentFilters.sortBy)
      params.append('sortOrder', currentFilters.sortOrder)

      const response = await fetch(`/api/search/meetings?${params.toString()}`)
      if (response.ok) {
        const searchResults = await response.json()
        setResults(searchResults)
      }
    } catch (error) {
      console.error('Error searching meetings:', error)
    } finally {
      setLoading(false)
    }
  }, [session])

  // Debounce search when query text changes
  useEffect(() => {
    if (!filters.query.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => executeSearch(filters), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [filters.query]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await executeSearch(filters)
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100">$1</mark>')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.slice(0, 5)
  }

  const getContentPreview = (content: string, query: string) => {
    if (!content) return ''

    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    if (!query.trim()) {
      return textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent
    }

    const lowerContent = textContent.toLowerCase()
    const lowerQuery = query.toLowerCase().trim()
    const index = lowerContent.indexOf(lowerQuery)

    if (index === -1) {
      return textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent
    }

    const start = Math.max(0, index - 100)
    const end = Math.min(textContent.length, index + query.length + 100)
    const preview = textContent.substring(start, end)

    return (start > 0 ? '...' : '') + preview + (end < textContent.length ? '...' : '')
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p>Precisa fazer login para pesquisar reuniões.</p>
        </div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Pesquisar Reuniões</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pesquisar por texto
                </label>
                <input
                  type="text"
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  placeholder="Procurar no conteúdo, agenda, ações..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Reunião
                </label>
                <select
                  value={filters.meetingType}
                  onChange={(e) => setFilters({ ...filters, meetingType: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="">Todos os tipos</option>
                  {meetingTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data final
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ordenar por
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as SearchFilters['sortBy'] })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="relevance">Relevância</option>
                  <option value="date">Data</option>
                  <option value="identifier">Identificador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ordem
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Pesquisando...' : 'Pesquisar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilters({
                    query: '',
                    meetingType: '',
                    dateFrom: '',
                    dateTo: '',
                    sortBy: 'relevance',
                    sortOrder: 'desc'
                  })
                  setResults([])
                }}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Limpar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Search Results */}
      <div aria-live="polite" aria-atomic="true">
        {loading && (
          <div className="text-center py-8" aria-busy="true" role="status">
            <div className="text-gray-500 dark:text-gray-400">Pesquisando...</div>
          </div>
        )}

        {!loading && results.length === 0 && (filters.query || filters.meetingType || filters.dateFrom || filters.dateTo) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nenhuma reunião encontrada com os critérios especificados.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Encontradas {results.length} reuniões
            </div>

            {results.map((meeting) => (
              <div
              key={meeting.id}
              onClick={() => router.push(`/meetings/${meeting.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      {meeting.identifier}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {meeting.meetingType.name}
                      </span>
                      <span>{formatDate(meeting.date)}</span>
                      {(meeting.startTime || meeting.endTime) && (
                        <span>
                          {meeting.startTime && formatTime(meeting.startTime)}
                          {meeting.startTime && meeting.endTime && ' - '}
                          {meeting.endTime && formatTime(meeting.endTime)}
                        </span>
                      )}
                      {meeting.location && (
                        <span>📍 {meeting.location}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/meetings/${meeting.id}/pdf`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-3 py-1 rounded text-sm hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                    >
                      PDF
                    </Link>
                  </div>
                </div>

                <div className="text-gray-700 dark:text-gray-300 text-sm">
                  {meeting.snippet ? (
                    <p
                      className="[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:dark:text-yellow-100 [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: meeting.snippet }}
                    />
                  ) : (
                    <p
                      dangerouslySetInnerHTML={{
                        __html: highlightText(getContentPreview(meeting.content, filters.query), filters.query)
                      }}
                    />
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Criado por {meeting.createdBy.name || meeting.createdBy.email}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
