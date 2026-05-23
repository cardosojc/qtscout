'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

const MAX_WIDTH = 600
const MAX_HEIGHT = 300

async function fileToProcessedDataUrl(file: File): Promise<string> {
  const reader = new FileReader()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha a ler a imagem'))
    img.src = dataUrl
  })

  const ratio = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(img, 0, 0, w, h)

  return canvas.toDataURL('image/png')
}

export default function SignaturePage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [signature, setSignature] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSignature = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/signature')
      if (res.ok) {
        const data = await res.json()
        setSignature(data.signature)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchSignature()
  }, [user, fetchSignature])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showToast('Apenas PNG ou JPEG', 'error')
      return
    }
    try {
      const dataUrl = await fileToProcessedDataUrl(file)
      setPending(dataUrl)
    } catch {
      showToast('Não foi possível processar a imagem', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!pending) return
    startLoading('A guardar...')
    try {
      const res = await fetch('/api/profile/signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: pending }),
      })
      if (res.ok) {
        const data = await res.json()
        setSignature(data.signature)
        setPending(null)
        showToast('Assinatura guardada', 'success')
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao guardar', 'error')
      }
    } finally {
      stopLoading()
    }
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Remover assinatura',
      message: 'Tem a certeza? Não poderá assinar novos documentos até carregar uma nova.',
      confirmLabel: 'Remover',
    })
    if (!confirmed) return
    startLoading('A remover...')
    try {
      const res = await fetch('/api/profile/signature', { method: 'DELETE' })
      if (res.ok) {
        setSignature(null)
        showToast('Assinatura removida', 'success')
      } else {
        showToast('Erro ao remover', 'error')
      }
    } finally {
      stopLoading()
    }
  }

  if (authLoading || !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: 'Minha Assinatura' }]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Minha Assinatura</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Carregue uma imagem da sua assinatura (PNG ou JPEG, fundo branco ou transparente).
          Esta assinatura será inserida nos documentos que assinar.
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Assinatura atual
            </p>
            {loading ? (
              <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : signature ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signature} alt="Assinatura" className="max-h-32 object-contain" />
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem assinatura carregada
              </div>
            )}
          </div>

          {pending && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Pré-visualização
              </p>
              <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-white flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pending} alt="Pré-visualização" className="max-h-32 object-contain" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors">
              Escolher imagem
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            {pending && (
              <>
                <button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setPending(null)}
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}
            {signature && !pending && (
              <button
                onClick={handleDelete}
                className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
