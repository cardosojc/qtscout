import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { requireAuth } from '../middleware/auth'
import type { AppEnv } from '../types'

export const profiles = new Hono<AppEnv>()

profiles.get('/leaders', requireAuth, async (c) => {
  const profiles = await prisma.profile.findMany({
    where: { role: { in: ['ADMIN', 'LEADER'] } },
    select: { id: true, name: true, email: true, section: true, roles: true },
    orderBy: { name: 'asc' },
  })
  return c.json({ profiles })
})
