'use client'

import { useAuth } from '@/components/providers/auth-provider'
import Link from 'next/link'
import { Navbar } from '@/components/ui/navbar'
import { DashboardSkeleton } from '@/components/ui/skeleton'

export default function Home() {
  const { user, loading } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />

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
          ) : user ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                  Bem-vindo, {user.name || user.email}!
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Gerencie as atas das suas reuniões de forma fácil e organizada.
                </p>

                <div className="grid md:grid-cols-3 gap-4">
                  <Link
                    href="/meetings/new"
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Nova Reunião
                  </Link>
                  <Link
                    href="/meetings"
                    className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Ver Reuniões
                  </Link>
                  <Link
                    href="/search"
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Pesquisar
                  </Link>
                </div>
              </div>
            </div>
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
      </main>

      <footer className="bg-gray-800 dark:bg-gray-950 text-white py-4 mt-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>CNE - instituição de utilidade pública</p>
        </div>
      </footer>
    </div>
  )
}
