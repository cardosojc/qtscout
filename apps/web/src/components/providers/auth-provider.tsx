'use client'
import { apiFetch } from '@/lib/api-client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { SessionUser } from '@/lib/api-schemas'

// Sign-in happens before the app loads: Cloudflare Access (one-time PIN by
// email) sits in front of the whole hostname. Here we only load the profile the
// API maps that identity to. `denied` means Access let the person in but there
// is no QTScout profile for their email.
type AuthContextType = {
  user: SessionUser | null
  loading: boolean
  denied: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  denied: false,
  signOut: async () => {},
})

// Ends the Access session (clears the CF_Authorization cookie for the app).
const ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/auth/profile')
      .then(async (response) => {
        if (cancelled) return
        if (response.ok) {
          setUser(await response.json())
        } else {
          setUser(null)
          setDenied(response.status === 403)
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signOut = async () => {
    setUser(null)
    window.location.href = ACCESS_LOGOUT_URL
  }

  return (
    <AuthContext.Provider value={{ user, loading, denied, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
