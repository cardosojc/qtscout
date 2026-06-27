'use client'
import { apiFetch } from '@/lib/api-client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient, setAccessToken } from '@/lib/supabase/client'
import type { SessionUser } from '@/lib/api-schemas'

type AuthContextType = {
  user: SessionUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/profile')
      if (response.ok) {
        const profile = await response.json()
        setUser(profile)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the restored session,
    // so it covers initial load too — no separate getUser() network round-trip
    // and no duplicate profile fetch. The backend re-validates the token on every
    // API call, so the client doesn't need to verify it here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Keep the token cache fresh for apiFetch (set before any profile fetch).
        setAccessToken(session?.access_token ?? null)
        if (session?.user) {
          // TOKEN_REFRESHED fires periodically with the same user — no need to
          // refetch the profile then.
          if (event !== 'TOKEN_REFRESHED') {
            await fetchProfile()
          }
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
