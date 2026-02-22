'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { RichTextEditor } from '@/components/editor/rich-text-editor'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/types/document'

interface NewDocumentFormProps {
  enabledTypes: { oficio: boolean; circular: boolean; ordem: boolean }
}

export function NewDocumentForm({ enabledTypes }: NewDocumentFormProps) {
  const { user: session } = useAuth()
  const { showToast } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const router = useRouter()
  const searchParams = useSearchParams()

  const ALL_TYPES: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']
  const types = ALL_TYPES.filter((t) => {
    if (t === 'OFICIO') return enabledTypes.oficio
    if (t === 'CIRCULAR') return enabledTypes.circular
    if (t === 'ORDEM_SERVICO') return enabledTypes.ordem
    return false
  })

  const paramType = searchParams.get('type') as DocumentType | null
  const initialType = paramType && types.includes(paramType) ? paramType : (types[0] || 'OFICIO')

  const [type, setType] = useState<DocumentType>(initialType)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    startLoading('A criar documento...')
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      })

      if (res.ok) {
        const doc = await res.json()
        showToast('Documento criado com sucesso', 'success')
        router.push(`/documents/${doc.id}`)
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao criar documento', 'error')
      }
    } catch {
      showToast('Erro ao criar documento', 'error')
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

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: 'Documentos', href: '/documents' },
        { label: 'Novo Documento' },
      ]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Novo Documento</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Documento
            </label>
            <div className="flex gap-3 flex-wrap">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    type === t
                      ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {DOCUMENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conteúdo
            </label>
            {type === 'ORDEM_SERVICO' ? (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900">
                Conteúdo em breve
              </div>
            ) : (
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder={`Escreva o conteúdo do ${DOCUMENT_TYPE_LABELS[type].toLowerCase()}...`}
              />
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'A criar...' : 'Criar Documento'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
