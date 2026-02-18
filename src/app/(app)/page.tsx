'use client'

import { redirect } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { DashboardSkeleton } from '@/components/ui/skeleton'

export default function Home() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    redirect('/meetings')
  }

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-blue-600 dark:bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">🏕️</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Sistema de Atas de Reunião
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Agrupamento 61 - Santa Maria dos Olivais
          </p>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
              Entre na sua conta
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Faça login para aceder ao sistema de atas de reunião.
            </p>
          </div>
        )}
      </div>

      <footer className="bg-gray-800 dark:bg-gray-950 text-white py-4 mt-16 rounded-lg transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>CNE - instituição de utilidade pública</p>
        </div>
      </footer>
    </main>
  )
}

