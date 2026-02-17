'use client'

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'

interface LoadingContextValue {
  startLoading: (message?: string) => void
  stopLoading: () => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export function useLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider')
  return ctx
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<{ active: boolean; message?: string }>({ active: false })

  const startLoading = useCallback((message?: string) => {
    setLoading({ active: true, message })
  }, [])

  const stopLoading = useCallback(() => {
    setLoading({ active: false })
  }, [])

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading }}>
      {children}

      {loading.active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          aria-busy="true"
          role="status"
        >
          <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 shadow-xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400" />
            {loading.message && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {loading.message}
              </p>
            )}
            <span className="sr-only">A carregar...</span>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}
