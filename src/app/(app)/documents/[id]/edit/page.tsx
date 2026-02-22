'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { DOCUMENT_TYPE_LABELS, type Document } from '@/types/document'

export default function EditDocumentPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string
  const { showToast } = useToast()
  const { startLoading, stopLoading } = useLoading()

  const [document, setDocument] = useState<Document | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchDocument = useCallback(async () => {
    startLoading('A carregar documento...')
    try {
      const res = await fetch(`/api/documents/${docId}`)
      if (res.ok) {
        const doc = await res.json()
        setDocument(doc)
        setContent(doc.content)
      }
    } catch {
      showToast('Erro ao carregar documento', 'error')
    } finally {
      setLoading(false)
      stopLoading()
    }
  }, [docId, showToast, startLoading, stopLoading])

  useEffect(() => {
    if (session && docId) fetchDocument()
  }, [session, docId, fetchDocument])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    startLoading('A guardar...')
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        showToast('Documento guardado', 'success')
        router.push(`/documents/${docId}`)
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao guardar', 'error')
      }
    } catch {
      showToast('Erro ao guardar', 'error')
    } finally {
      setSubmitting(false)
      stopLoading()
    }
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p>Precisa fazer login.</p>
      </div>
    )
  }

  if (loading || !document) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Documentos', href: `/documents?type=${document.type}` },
        { label: document.identifier, href: `/documents/${document.id}` },
        { label: 'Editar' },
      ]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{document.identifier}</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {DOCUMENT_TYPE_LABELS[document.type]}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conteúdo
            </label>
            {document.type === 'ORDEM_SERVICO' ? (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900">
                Conteúdo em breve
              </div>
            ) : (
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder={`Escreva o conteúdo do ${DOCUMENT_TYPE_LABELS[document.type].toLowerCase()}...`}
              />
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push(`/documents/${docId}`)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
