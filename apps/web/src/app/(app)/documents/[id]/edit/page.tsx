'use client'
import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { RichTextEditor } from '@/components/editor/rich-text-editor-dynamic'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { DOCUMENT_TYPE_LABELS, type Document } from '@qtscout/types/document'
import { documentKey, refreshCached, useDocument } from '@/lib/api-hooks'

export default function EditDocumentPage() {
  const { user: session } = useAuth()
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string

  const { data: document, error } = useDocument<Document>(docId, !!session)

  // OS documents are generated from items and are not editable here.
  const isOrdemServico = document?.type === 'ORDEM_SERVICO'
  useEffect(() => {
    if (isOrdemServico) router.replace(`/documents/${docId}`)
  }, [isOrdemServico, docId, router])

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p>Precisa fazer login.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-red-500">Erro ao carregar documento</p>
      </div>
    )
  }

  if (!document || isOrdemServico) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  // Keyed by id so the editor's state starts from this document's content.
  return <EditDocumentForm key={document.id} document={document} />
}

function EditDocumentForm({ document }: { document: Document }) {
  const router = useRouter()
  const docId = document.id
  const { showToast } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const [content, setContent] = useState(document.content)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    startLoading('A guardar...')
    try {
      const res = await apiFetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        showToast('Documento guardado', 'success')
        await refreshCached(documentKey(docId))
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
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder={`Escreva o conteúdo do ${DOCUMENT_TYPE_LABELS[document.type].toLowerCase()}...`}
            />
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
