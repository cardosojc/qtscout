'use client'
import { apiFetch } from '@/lib/api-client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { LEADER_ROLES, type LeaderRole } from '@qtscout/types/leader-role'
import { ORDEM_SECTIONS, ORDEM_SECTION_LABELS, type OrdemSection } from '@qtscout/types/ordem-item'

const SECTION_LEVEL_ROLES: LeaderRole[] = [
  'Chefe de Unidade',
  'Chefe de Unidade Adjunto',
  'Instrutor',
]

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

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [signature, setSignature] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [roles, setRoles] = useState<LeaderRole[]>([])
  const [savedRoles, setSavedRoles] = useState<LeaderRole[]>([])
  const [section, setSection] = useState<OrdemSection | ''>('')
  const [savedSection, setSavedSection] = useState<OrdemSection | ''>('')
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    try {
      const [sigRes, rolesRes, sectionRes] = await Promise.all([
        apiFetch('/api/profile/signature'),
        apiFetch('/api/profile/roles'),
        apiFetch('/api/profile/section'),
      ])
      if (sigRes.ok) {
        const data = await sigRes.json()
        setSignature(data.signature)
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.roles ?? [])
        setSavedRoles(data.roles ?? [])
      }
      if (sectionRes.ok) {
        const data = await sectionRes.json()
        setSection(data.section ?? '')
        setSavedSection(data.section ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchProfile()
  }, [user, fetchProfile])

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

  const handleSaveSignature = async () => {
    if (!pending) return
    startLoading('A guardar...')
    try {
      const res = await apiFetch('/api/profile/signature', {
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

  const handleDeleteSignature = async () => {
    const confirmed = await showConfirm({
      title: 'Remover assinatura',
      message: 'Tem a certeza? Não poderá assinar novos documentos até carregar uma nova.',
      confirmLabel: 'Remover',
    })
    if (!confirmed) return
    startLoading('A remover...')
    try {
      const res = await apiFetch('/api/profile/signature', { method: 'DELETE' })
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

  const toggleRole = (role: LeaderRole) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const needsSection = roles.some((r) => SECTION_LEVEL_ROLES.includes(r))

  const handleSaveRoles = async () => {
    if (needsSection && !section) {
      showToast('Selecione a secção antes de guardar', 'error')
      return
    }
    startLoading('A guardar...')
    try {
      const [rolesRes, sectionRes] = await Promise.all([
        apiFetch('/api/profile/roles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles }),
        }),
        apiFetch('/api/profile/section', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: needsSection ? section : null }),
        }),
      ])
      if (rolesRes.ok && sectionRes.ok) {
        const rolesData = await rolesRes.json()
        const sectionData = await sectionRes.json()
        setRoles(rolesData.roles)
        setSavedRoles(rolesData.roles)
        setSection(sectionData.section ?? '')
        setSavedSection(sectionData.section ?? '')
        showToast('Funções guardadas', 'success')
      } else {
        const errRes = !rolesRes.ok ? rolesRes : sectionRes
        const data = await errRes.json().catch(() => ({}))
        showToast(data.error || 'Erro ao guardar', 'error')
      }
    } finally {
      stopLoading()
    }
  }

  const rolesDirty =
    roles.length !== savedRoles.length ||
    roles.some((r) => !savedRoles.includes(r)) ||
    section !== savedSection

  if (authLoading || !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[{ label: 'Meu Perfil' }]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Funções</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Selecione as funções que desempenha no agrupamento. Aparecerão entre parênteses junto à sua
          assinatura nos documentos.
        </p>

        {loading ? (
          <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="space-y-2">
              {LEADER_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">{role}</span>
                </label>
              ))}
            </div>

            {needsSection && (
              <div className="mt-6 p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                  Secção
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                  As funções de Chefe de Unidade, Adjunto e Instrutor estão associadas a uma secção.
                </p>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value as OrdemSection | '')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Selecione —</option>
                  {ORDEM_SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ORDEM_SECTION_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveRoles}
            disabled={!rolesDirty || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Guardar Funções
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Assinatura</h2>
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
                  onClick={handleSaveSignature}
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
                onClick={handleDeleteSignature}
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
