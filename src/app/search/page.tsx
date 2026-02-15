'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import Link from 'next/link'
import { Navbar } from '@/components/ui/navbar'

interface SearchResult {
  id: string
  identifier: string
  date: string
  startTime?: string
  endTime?: string
  location?: string
  content: string
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
  sortBy: 'date' | 'identifier'
  sortOrder: 'asc' | 'desc'
}

export default function SearchPage() {
  const { user: session } = useAuth()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [meetingTypes, setMeetingTypes] = useState<{ id: string; name: string; code: string }[]>([])
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    meetingType: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.query) params.append('q', filters.query)
      if (filters.meetingType) params.append('type', filters.meetingType)
      if (filters.dateFrom) params.append('from', filters.dateFrom)
      if (filters.dateTo) params.append('to', filters.dateTo)
      params.append('sortBy', filters.sortBy)
      params.append('sortOrder', filters.sortOrder)

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
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.trim()})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
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
    
    // Strip HTML tags for preview
    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    
    if (!query.trim()) {
      return textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent
    }
    
    // Find the query in the content and show context
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>Precisa fazer login para pesquisar reuniões.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Pesquisar Reuniões</h1>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pesquisar por texto
                  </label>
                  <input
                    type="text"
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                    placeholder="Procurar no conteúdo, agenda, ações..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Reunião
                  </label>
                  <select
                    value={filters.meetingType}
                    onChange={(e) => setFilters({ ...filters, meetingType: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordenar por
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as 'date' | 'identifier' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="date">Data</option>
                    <option value="identifier">Identificador</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordem
                  </label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      sortBy: 'date',
                      sortOrder: 'desc'
                    })
                    setResults([])
                  }}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200"
                >
                  Limpar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Search Results */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-gray-500">Pesquisando...</div>
          </div>
        )}

        {!loading && results.length === 0 && filters.query && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Nenhuma reunião encontrada com os critérios especificados.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Encontradas {results.length} reuniões
            </div>
            
            {results.map((meeting) => (
              <div key={meeting.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-blue-600 mb-2">
                      <Link href={`/meetings/${meeting.id}`} className="hover:underline">
                        {meeting.identifier}
                      </Link>
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
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
                      href={`/meetings/${meeting.id}`}
                      className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/meetings/${meeting.id}/pdf`}
                      className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm hover:bg-green-200"
                    >
                      PDF
                    </Link>
                  </div>
                </div>
                
                {meeting.content && (
                  <div className="text-gray-700 text-sm">
                    <p
                      dangerouslySetInnerHTML={{
                        __html: highlightText(getContentPreview(meeting.content, filters.query), filters.query)
                      }}
                    />
                  </div>
                )}
                
                <div className="mt-3 text-xs text-gray-500">
                  Criado por {meeting.createdBy.name || meeting.createdBy.email}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}