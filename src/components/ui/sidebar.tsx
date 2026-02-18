'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  {
    href: '/meetings',
    label: 'Reuniões',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/meetings/new',
    label: 'Nova Reunião',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Pesquisar',
    badge: '⌘K',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/signin')
  }

  const isActive = (href: string) => {
    if (href === '/meetings') return pathname === '/meetings'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-4 border-b border-blue-500 dark:border-gray-700">
        <Link
          href="/"
          className="font-bold text-lg text-white leading-tight block"
          onClick={() => setMobileOpen(false)}
        >
          Agrupamento 61
          <span className="block text-sm font-normal text-blue-200 dark:text-gray-400">
            Santa Maria dos Olivais
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav aria-label="Navegação principal" className="flex-1 p-3 space-y-1">
        {loading ? (
          <div className="text-blue-200 dark:text-gray-400 text-sm px-3 py-2">Loading...</div>
        ) : user ? (
          navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-700 dark:bg-gray-700 text-white'
                    : 'text-blue-100 dark:text-gray-300 hover:bg-blue-500 dark:hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-sans">
                    {item.badge}
                  </kbd>
                )}
              </Link>
            )
          })
        ) : (
          <Link
            href="/auth/signin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 dark:text-gray-300 hover:bg-blue-500 dark:hover:bg-gray-700 hover:text-white transition-colors"
          >
            Entrar
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-blue-500 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-blue-200 dark:text-gray-400">Tema</span>
          <div className="[&_button]:bg-blue-500 [&_button]:hover:bg-blue-400 [&_button]:dark:bg-gray-700 [&_button]:dark:hover:bg-gray-600">
            <ThemeToggle />
          </div>
        </div>
        {user && (
          <>
            <div className="px-1">
              <p className="text-xs text-blue-200 dark:text-gray-400 truncate">
                {user.name || user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 dark:text-gray-300 hover:bg-blue-500 dark:hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-blue-600 dark:bg-gray-800 h-16 flex items-center px-4 shadow-lg">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Abrir menu"
          className="p-2 rounded-lg text-white hover:bg-blue-500 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="ml-3 font-bold text-white text-lg">Agrupamento 61</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-blue-600 dark:bg-gray-800 text-white transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col bg-blue-600 dark:bg-gray-800 text-white shadow-lg">
        {sidebarContent}
      </aside>
    </>
  )
}
