'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ScoutForm } from '@/components/membros/scout-form'
import { scoutDisplayName, type Scout } from '@/types/scout'

export default function MembroDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [scout, setScout] = useState<Scout | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchScout = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scouts/${id}`)
      if (res.ok) {
        const data = await res.json()
        setScout(data.scout)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (user) fetchScout()
  }, [user, fetchScout])

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (!scout) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Membro não encontrado.</p>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[
        { label: 'Membros', href: '/membros' },
        { label: scoutDisplayName(scout) },
      ]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {scoutDisplayName(scout)}
        </h1>
        {user?.role === 'ADMIN' ? (
          <ScoutForm
            initial={scout}
            submitLabel="Guardar"
            onCancel={() => router.push('/membros')}
            onSubmit={async (values) => {
              const res = await fetch(`/api/scouts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
              })
              if (res.ok) {
                const data = await res.json()
                setScout(data.scout)
                showToast('Membro atualizado', 'success')
              } else {
                const data = await res.json().catch(() => ({}))
                showToast(data.error || 'Erro ao guardar', 'error')
              }
            }}
          />
        ) : (
          <dl className="space-y-2 text-sm">
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Nº Associado</dt><dd>{scout.numeroAssociado ?? '—'}</dd></div>
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Data de nascimento</dt><dd>{new Date(scout.dateOfBirth).toLocaleDateString('pt-PT')}</dd></div>
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Email</dt><dd>{scout.email ?? '—'}</dd></div>
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Telemóvel</dt><dd>{scout.telemovel ?? '—'}</dd></div>
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Telefone</dt><dd>{scout.telefone ?? '—'}</dd></div>
            <div><dt className="font-medium text-gray-700 dark:text-gray-200">Encarregado</dt><dd>{scout.encarregadoNome ?? '—'} {scout.encarregadoTelefone ? `(${scout.encarregadoTelefone})` : ''}{scout.encarregadoEmail ? ` ${scout.encarregadoEmail}` : ''}</dd></div>
          </dl>
        )}
      </div>
    </main>
  )
}
