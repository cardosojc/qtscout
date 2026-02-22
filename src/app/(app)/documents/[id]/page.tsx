'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useLoading } from '@/components/ui/loading-overlay'
import { useToast } from '@/components/ui/toast'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import Link from 'next/link'
import { DOCUMENT_TYPE_LABELS, type Document } from '@/types/document'

export default function DocumentDetailPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string
  const { startLoading, stopLoading } = useLoading()
  const { showToast, showConfirm } = useToast()

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocument = useCallback(async () => {
    startLoading('A carregar documento...')
    try {
      setLoading(true)
      const res = await fetch(`/api/documents/${docId}`)
      if (res.ok) {
        setDocument(await res.json())
      } else if (res.status === 404) {
        setError('Documento não encontrado')
      } else {
        setError('Erro ao carregar documento')
      }
    } catch {
      setError('Erro ao carregar documento')
    } finally {
      setLoading(false)
      stopLoading()
    }
  }, [docId, startLoading, stopLoading])

  useEffect(() => {
    if (session && docId) fetchDocument()
  }, [session, docId, fetchDocument])

  const handleDelete = async () => {
    if (!document) return
    const confirmed = await showConfirm({
      title: 'Eliminar documento',
      message: `Tem certeza que deseja eliminar "${document.identifier}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return

    startLoading('A eliminar...')
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Documento eliminado', 'success')
        router.push('/documents')
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao eliminar', 'error')
      }
    } catch {
      showToast('Erro ao eliminar', 'error')
    } finally {
      stopLoading()
    }
  }

  const formatDateTime = (s: string) => new Date(s).toLocaleString('pt-PT')

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p>Precisa fazer login.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-red-500">{error}</p>
        <Link href="/documents" className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Voltar aos Documentos
        </Link>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Documentos', href: `/documents?type=${document.type}` },
        { label: document.identifier },
      ]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md transition-colors">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {document.identifier}
              </h1>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {DOCUMENT_TYPE_LABELS[document.type]}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/documents/${document.id}/edit`}
                className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Editar
              </Link>
              {session.role === 'ADMIN' && (
                <button
                  onClick={handleDelete}
                  className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Meta */}
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p><span className="font-medium">Criado por:</span> {document.createdBy.name || document.createdBy.email}</p>
            <p><span className="font-medium">Criado em:</span> {formatDateTime(document.createdAt)}</p>
            {document.updatedAt !== document.createdAt && (
              <p><span className="font-medium">Atualizado em:</span> {formatDateTime(document.updatedAt)}</p>
            )}
          </div>

          {/* Content */}
          {document.content && document.content.trim() !== '' && document.content !== '<p></p>' ? (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: document.content }}
            />
          ) : (
            <p className="text-gray-400 dark:text-gray-500 italic">Sem conteúdo.</p>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <Link href={`/documents?type=${document.type}`} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            ← Voltar aos Documentos
          </Link>
          <span className="text-sm text-gray-500 dark:text-gray-400">{document.identifier}</span>
        </div>
      </div>
    </main>
  )
}
