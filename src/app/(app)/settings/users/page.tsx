'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useLoading } from '@/components/ui/loading-overlay'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

type UserRole = 'ADMIN' | 'LEADER' | 'MEMBER'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  LEADER: 'Chefe',
  MEMBER: 'Membro',
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  LEADER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  MEMBER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

interface User {
  id: string
  name: string
  email: string
  username: string
  role: UserRole
  createdAt: string
}

export default function UsersSettingsPage() {
  const { user: session, loading: authLoading } = useAuth()
  const { showToast, showConfirm } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && session && session.role !== 'ADMIN') router.replace('/')
  }, [session, authLoading, router])

  useEffect(() => {
    if (session?.role === 'ADMIN') fetchUsers()
  }, [session])

  const fetchUsers = async () => {
    startLoading('A carregar utilizadores...')
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch {
      showToast('Erro ao carregar utilizadores', 'error')
    } finally {
      setLoading(false)
      stopLoading()
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)))
        showToast('Papel atualizado', 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao atualizar papel', 'error')
      }
    } catch {
      showToast('Erro ao atualizar papel', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar utilizador',
      message: `Tem certeza que deseja eliminar "${userName}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Eliminar',
    })
    if (!confirmed) return

    startLoading('A eliminar utilizador...')
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        showToast('Utilizador eliminado', 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao eliminar utilizador', 'error')
      }
    } catch {
      showToast('Erro ao eliminar utilizador', 'error')
    } finally {
      stopLoading()
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' })

  if (authLoading || !session) return null
  if (session.role !== 'ADMIN') return null

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: 'Definições', href: '/settings' }, { label: 'Utilizadores' }]} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Utilizadores</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerir contas e papéis dos utilizadores do sistema.
            </p>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {users.length} utilizador{users.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isSelf = user.id === session.id
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      {isSelf && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">(você)</span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email} · @{user.username} · desde {formatDate(user.createdAt)}
                    </p>
                  </div>

                  {/* Role selector */}
                  <select
                    value={user.role}
                    disabled={isSelf || updatingId === user.id}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="MEMBER">Membro</option>
                    <option value="LEADER">Chefe</option>
                    <option value="ADMIN">Administrador</option>
                  </select>

                  {/* Delete */}
                  <button
                    disabled={isSelf || updatingId === user.id}
                    onClick={() => handleDelete(user.id, user.name)}
                    title="Eliminar utilizador"
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
