'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ScoutForm } from '@/components/membros/scout-form'

export default function NovoMembroPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!loading && user && user.role !== 'ADMIN') router.replace('/membros')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[
        { label: 'Membros', href: '/membros' },
        { label: 'Novo' },
      ]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Novo Membro</h1>
        <ScoutForm
          submitLabel="Criar"
          onCancel={() => router.push('/membros')}
          onSubmit={async (values) => {
            const res = await fetch('/api/scouts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            })
            if (res.ok) {
              const data = await res.json()
              showToast('Membro criado', 'success')
              router.push(`/membros/${data.scout.id}`)
            } else {
              const data = await res.json().catch(() => ({}))
              showToast(data.error || 'Erro ao criar', 'error')
            }
          }}
        />
      </div>
    </main>
  )
}
