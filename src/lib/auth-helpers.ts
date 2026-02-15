import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export type SessionUser = {
  id: string
  email: string
  name: string
  username: string
  role: 'ADMIN' | 'LEADER' | 'MEMBER'
}

export type Session = {
  user: SessionUser
} | null

export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
    },
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
})
