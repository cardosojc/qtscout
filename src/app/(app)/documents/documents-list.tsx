'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import Link from 'next/link'
import { DOCUMENT_TYPE_LABELS, type DocumentType, type Document } from '@/types/document'

interface DocumentsListProps {
  enabledTypes: { oficio: boolean; circular: boolean; ordem: boolean }
}

export function DocumentsList({ enabledTypes }: DocumentsListProps) {
  const { user: session } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const router = useRouter()
  const searchParams = useSearchParams()

  const ALL_TABS: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']
  const tabs = ALL_TABS.filter((t) => {
    if (t === 'OFICIO') return enabledTypes.oficio
    if (t === 'CIRCULAR') return enabledTypes.circular
    if (t === 'ORDEM_SERVICO') return enabledTypes.ordem
    return false
  })

  const activeType = (searchParams.get('type') as DocumentType) || tabs[0] || 'OFICIO'
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })

  const fetchDocuments = useCallback(async (type: DocumentType, page: number) => {
    startLoading('A carregar documentos...')
    try {
      const res = await fetch(`/api/documents?type=${type}&page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
      stopLoading()
    }
  }, [startLoading, stopLoading])

  useEffect(() => {
    if (session) {
      setLoading(true)
      setCurrentPage(1)
      fetchDocuments(activeType, 1)
    }
  }, [session, activeType, fetchDocuments])

  useEffect(() => {
    if (session && currentPage > 1) {
      fetchDocuments(activeType, currentPage)
    }
  }, [session, currentPage, activeType, fetchDocuments])

  const deleteDocument = async (docId: string, identifier: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar documento',
      message: `Tem certeza que deseja eliminar "${identifier}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return

    startLoading('A eliminar...')
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Documento eliminado com sucesso', 'success')
        fetchDocuments(activeType, currentPage)
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao eliminar documento', 'error')
      }
    } catch {
      showToast('Erro ao eliminar documento', 'error')
    } finally {
      stopLoading()
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-gray-900 dark:text-gray-100">Precisa fazer login para ver os documentos.</p>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Documentos</h1>
        <Link
          href={`/documents/new?type=${activeType}`}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Novo
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex gap-6">
          {tabs.map((type) => (
            <button
              key={type}
              onClick={() => router.push(`/documents?type=${type}`)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeType === type
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {DOCUMENT_TYPE_LABELS[type]}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Ainda não há {DOCUMENT_TYPE_LABELS[activeType].toLowerCase()}s criados.
          </p>
          <Link
            href={`/documents/new?type=${activeType}`}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Criar Primeiro
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => router.push(`/documents/${doc.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {doc.identifier}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {DOCUMENT_TYPE_LABELS[doc.type]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(doc.createdAt)} · {doc.createdBy.name || doc.createdBy.email}
                  </p>
                </div>
                {session.role === 'ADMIN' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id, doc.identifier) }}
                    className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-200 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Anterior
          </button>
          <div className="flex gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={currentPage === pagination.totalPages}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Próxima
          </button>
        </div>
      )}

      {pagination.total > 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
          Mostrando {((currentPage - 1) * pagination.limit) + 1} a {Math.min(currentPage * pagination.limit, pagination.total)} de {pagination.total} documentos
        </div>
      )}
    </main>
  )
}
