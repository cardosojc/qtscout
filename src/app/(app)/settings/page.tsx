'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_PREFIXES, type DocumentType, type DocumentSettings } from '@/types/document'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

const ALL_TYPES: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']

function nextIdentifierPreview(type: DocumentType, startingNumber: number): string {
  const prefix = DOCUMENT_TYPE_PREFIXES[type]
  const num = startingNumber.toString().padStart(3, '0')
  if (type === 'ORDEM_SERVICO') return `${prefix}-${num}`
  return `${prefix}-${num}/${new Date().getFullYear()}`
}

export default function SettingsPage() {
  const { user: session, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const router = useRouter()

  const [settings, setSettings] = useState<DocumentSettings[]>(
    ALL_TYPES.map((type) => ({ type, startingNumber: 1 }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && session && session.role !== 'ADMIN') {
      router.replace('/')
    }
  }, [session, authLoading, router])

  useEffect(() => {
    if (session?.role === 'ADMIN') {
      fetchSettings()
    }
  }, [session])

  const fetchSettings = async () => {
    startLoading('A carregar definições...')
    try {
      const res = await fetch('/api/settings/documents')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch {
      showToast('Erro ao carregar definições', 'error')
    } finally {
      setLoading(false)
      stopLoading()
    }
  }

  const handleChange = (type: DocumentType, value: number) => {
    setSettings((prev) =>
      prev.map((s) => (s.type === type ? { ...s, startingNumber: value } : s))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    startLoading('A guardar...')
    try {
      const res = await fetch('/api/settings/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (res.ok) {
        showToast('Definições guardadas', 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao guardar', 'error')
      }
    } catch {
      showToast('Erro ao guardar', 'error')
    } finally {
      setSaving(false)
      stopLoading()
    }
  }

  if (authLoading || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (session.role !== 'ADMIN') return null

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: 'Definições' }]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Definições</h1>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
            Documentos emitidos fora deste sistema
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Se já foram emitidos documentos com números atribuídos fora deste sistema, defina aqui o próximo número a usar
            (último número emitido + 1). O sistema iniciará a sequência a partir desse número quando o primeiro
            documento for criado nesta plataforma.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {ALL_TYPES.map((t) => (
              <div key={t} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {settings.map((s) => (
              <div key={s.type} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{DOCUMENT_TYPE_LABELS[s.type]}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {s.type === 'ORDEM_SERVICO' ? 'Sequência contínua global (sem reinício anual)' : 'Reinicia a cada ano'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Próximo documento</p>
                    <p className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {nextIdentifierPreview(s.type, s.startingNumber + 1)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">Número inicial:</label>
                    <input
                      type="number"
                      min={1}
                      value={s.startingNumber}
                      onChange={(e) => handleChange(s.type, parseInt(e.target.value) || 1)}
                      className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'A guardar...' : 'Guardar Definições'}
          </button>
        </div>
      </div>
    </main>
  )
}
