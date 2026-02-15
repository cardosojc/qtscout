'use client'

import { useState } from 'react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim()
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'Erro ao enviar email de redefinição')
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      setError('Erro ao enviar email de redefinição')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-24 h-24 bg-blue-600 dark:bg-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
          <span className="text-white text-3xl font-bold">🏕️</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Esqueceu a palavra-passe?
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          Introduza o seu email para receber um link de redefinição
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 transition-colors">
          {success ? (
            <div className="text-center">
              <div className="rounded-md bg-green-50 dark:bg-green-900/50 p-4 mb-6">
                <div className="text-sm text-green-800 dark:text-green-200">
                  Se o email existir no sistema, receberá um link de redefinição de palavra-passe.
                </div>
              </div>
              <Link
                href="/auth/signin"
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email *
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
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
                  disabled={loading || !email.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
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