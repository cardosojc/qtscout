'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLoading } from '@/components/ui/loading-overlay'

export default function ResetPasswordPage() {
  const [error, setError] = useState('')
  const { startLoading, stopLoading } = useLoading()
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validSession, setValidSession] = useState<boolean | null>(null)

  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setValidSession(!!session)
    }
    checkSession()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || !confirmPassword.trim()) return

    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem')
      return
    }

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres')
      return
    }

    startLoading('A redefinir...')
    setError('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          confirmPassword: confirmPassword.trim()
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/auth/signin')
        }, 3000)
      } else {
        setError(data.error || 'Erro ao redefinir palavra-passe')
      }
    } catch (error) {
      console.error('Reset password error:', error)
      setError('Erro ao redefinir palavra-passe')
    } finally {
      stopLoading()
    }
  }

  if (validSession === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">A carregar...</p>
        </div>
      </div>
    )
  }

  if (!validSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 transition-colors text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Link inválido ou expirado.</p>
            <Link
              href="/auth/forgot-password"
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              Solicitar novo link de redefinição
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-24 h-24 bg-blue-600 dark:bg-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
          <span className="text-white text-3xl font-bold">🏕️</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Redefinir palavra-passe
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          Introduza a sua nova palavra-passe
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 transition-colors">
          {success ? (
            <div className="text-center">
              <div className="rounded-md bg-green-50 dark:bg-green-900/50 p-4 mb-6">
                <div className="text-sm text-green-800 dark:text-green-200">
                  Palavra-passe redefinida com sucesso! Será redirecionado para a página de login em alguns segundos.
                </div>
              </div>
              <Link
                href="/auth/signin"
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
              >
                Ir para o login agora
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nova palavra-passe *
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirmar palavra-passe *
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repita a palavra-passe"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                  <div className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={!password.trim() || !confirmPassword.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Redefinir palavra-passe
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="text-center">
              <Link
                href="/auth/signin"
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
              >
                Voltar ao login
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sistema de Atas de Reunião - CNE
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
