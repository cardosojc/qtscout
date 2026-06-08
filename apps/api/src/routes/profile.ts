import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { isLeaderRole } from '@qtscout/types/leader-role'
import { isOrdemSection } from '@qtscout/types/ordem-item'
import { requireAuth } from '../middleware/auth'
import type { AppEnv } from '../types'

const MAX_SIGNATURE_BYTES = 500_000 // ~500KB of base64 payload
const ALLOWED_MIME = /^data:image\/(png|jpe?g);base64,/i

export const profile = new Hono<AppEnv>()
profile.use('*', requireAuth)

profile.get('/roles', async (c) => {
  const session = c.get('session')
  const p = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  })
  return c.json({ roles: p?.roles ?? [] })
})

profile.put('/roles', async (c) => {
  const session = c.get('session')
  const { roles } = (await c.req.json()) as { roles?: unknown }
  if (!Array.isArray(roles) || !roles.every(isLeaderRole)) {
    return c.json({ error: 'Funções inválidas' }, 400)
  }
  const unique = Array.from(new Set(roles))
  await prisma.profile.update({ where: { id: session.user.id }, data: { roles: unique } })
  return c.json({ roles: unique })
})

profile.get('/section', async (c) => {
  const session = c.get('session')
  const p = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { section: true },
  })
  return c.json({ section: p?.section ?? null })
})

profile.put('/section', async (c) => {
  const session = c.get('session')
  const body = (await c.req.json()) as { section?: unknown }
  const section = body.section
  if (section !== null && !isOrdemSection(section)) {
    return c.json({ error: 'Secção inválida' }, 400)
  }
  await prisma.profile.update({ where: { id: session.user.id }, data: { section: section ?? null } })
  return c.json({ section: section ?? null })
})

profile.get('/signature', async (c) => {
  const session = c.get('session')
  const p = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { signature: true },
  })
  return c.json({ signature: p?.signature ?? null })
})

profile.put('/signature', async (c) => {
  const session = c.get('session')
  const { signature } = (await c.req.json()) as { signature?: string }
  if (typeof signature !== 'string' || !ALLOWED_MIME.test(signature)) {
    return c.json({ error: 'Imagem inválida (PNG ou JPEG)' }, 400)
  }
  if (signature.length > MAX_SIGNATURE_BYTES) {
    return c.json({ error: 'Imagem demasiado grande (máx. ~400KB)' }, 413)
  }
  await prisma.profile.update({ where: { id: session.user.id }, data: { signature } })
  return c.json({ signature })
})

profile.delete('/signature', async (c) => {
  const session = c.get('session')
  await prisma.profile.update({ where: { id: session.user.id }, data: { signature: null } })
  return c.json({ signature: null })
})
