import { createClient } from '@supabase/supabase-js'
import { prisma } from '@qtscout/db'

export type { SessionUser, Session } from '@qtscout/types/session'
import type { Session } from '@qtscout/types/session'

/** Extract the raw token from an `Authorization: Bearer <jwt>` header value. */
export function bearerFromHeader(authHeader: string | null | undefined): string | undefined {
  if (!authHeader) return undefined
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  return match?.[1]
}

/**
 * Validate a Supabase access token and hydrate the local Profile, returning the
 * same Session shape the web app's cookie-based getSession() produces. Works for
 * the browser UI and any external client that presents a Supabase JWT.
 */
export async function getSessionFromToken(token: string | undefined): Promise<Session> {
  if (!token) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, username: true, role: true },
  })
  if (!profile) return null

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      username: profile.username,
      role: profile.role,
    },
  }
}
