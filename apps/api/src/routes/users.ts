import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { createSupabaseAdmin } from '../lib/supabase-admin'
import type { AppEnv } from '../types'

export const users = new Hono<AppEnv>()
users.use('*', requireAuth, requireAdmin)

users.get('/', async (c) => {
  const users = await prisma.profile.findMany({
    select: { id: true, name: true, email: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return c.json({ users })
})

users.patch('/:id', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')
  if (id === session.user.id) {
    return c.json({ error: 'Não pode alterar o seu próprio papel' }, 400)
  }
  const { role } = await c.req.json()
  if (!['ADMIN', 'LEADER', 'MEMBER'].includes(role)) {
    return c.json({ error: 'Papel inválido' }, 400)
  }
  const user = await prisma.profile.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, username: true, role: true, createdAt: true },
  })
  return c.json({ user })
})

users.delete('/:id', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')
  if (id === session.user.id) {
    return c.json({ error: 'Não pode eliminar a sua própria conta' }, 400)
  }
  const supabaseAdmin = createSupabaseAdmin()
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) {
    return c.json({ error: authError.message }, 500)
  }
  await prisma.profile.delete({ where: { id } })
  return c.json({ message: 'Utilizador eliminado' })
})
