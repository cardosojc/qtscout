'use client'

import { useAuth } from '@/components/providers/auth-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'

export function Navbar() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/signin')
  }

  return (
    <nav className="bg-blue-600 dark:bg-gray-800 text-white shadow-lg transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="font-bold text-xl">
              Agrupamento 61 - Santa Maria dos Olivais
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {loading ? (
              <div>Loading...</div>
            ) : user ? (
              <>
                <Link href="/meetings" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Reuniões
                </Link>
                <Link href="/meetings/new" className="hover:text-blue-200 dark:hover:text-gray-300">
                  Nova Reunião
                </Link>
                <ThemeToggle />
                <div className="flex items-center space-x-2">
                  <span className="text-sm">
                    Olá, {user.name || user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
                  >
                    Sair
                  </button>
                </div>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link
                  href="/auth/signin"
                  className="bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded transition-colors"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
