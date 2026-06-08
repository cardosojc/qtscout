import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { requireAuth } from '../middleware/auth'
import { createSupabaseAdmin } from '../lib/supabase-admin'
import type { AppEnv } from '../types'

export const auth = new Hono<AppEnv>()

auth.get('/profile', requireAuth, async (c) => {
  return c.json(c.get('session').user)
})

auth.post('/register', async (c) => {
  try {
    const { username, email, name, password, confirmPassword } = await c.req.json()

    if (!username || !email || !name || !password || !confirmPassword) {
      return c.json({ error: 'Todos os campos são obrigatórios' }, 400)
    }
    if (password !== confirmPassword) {
      return c.json({ error: 'As palavras-passe não coincidem' }, 400)
    }
    if (password.length < 6) {
      return c.json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres' }, 400)
    }

    const existingUsername = await prisma.profile.findUnique({ where: { username } })
    if (existingUsername) {
      return c.json({ error: 'Nome de utilizador já existe' }, 400)
    }
    const existingEmail = await prisma.profile.findUnique({ where: { email } })
    if (existingEmail) {
      return c.json({ error: 'Email já está registado' }, 400)
    }

    const supabaseAdmin = createSupabaseAdmin()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username },
    })
    if (authError) {
      return c.json({ error: authError.message }, 400)
    }

    const profile = await prisma.profile.create({
      data: { id: authData.user.id, username, email, name, role: 'MEMBER' },
      select: { id: true, username: true, email: true, name: true, role: true, createdAt: true },
    })

    return c.json({ message: 'Utilizador criado com sucesso', user: profile }, 201)
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'Erro interno do servidor' }, 500)
  }
})
