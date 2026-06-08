import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import type { DocumentType } from '@qtscout/types/document'
import { requireAuth, requireAdmin } from '../middleware/auth'
import type { AppEnv } from '../types'

const ALL_TYPES: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']

export const settings = new Hono<AppEnv>()
settings.use('*', requireAuth)

settings.get('/documents', async (c) => {
  try {
    const rows = await prisma.documentSettings.findMany()
    const settingsMap = Object.fromEntries(rows.map((r) => [r.type, r.startingNumber]))
    const settings = ALL_TYPES.map((type) => ({
      type,
      startingNumber: settingsMap[type] ?? 1,
    }))
    return c.json({ settings })
  } catch (error) {
    console.error('Error fetching document settings:', error)
    return c.json({ error: 'Failed to fetch settings' }, 500)
  }
})

settings.put('/documents', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const { settings } = body as { settings: { type: DocumentType; startingNumber: number }[] }
    await Promise.all(
      settings.map((s) =>
        prisma.documentSettings.upsert({
          where: { type: s.type },
          create: { type: s.type, startingNumber: s.startingNumber },
          update: { startingNumber: s.startingNumber },
        }),
      ),
    )
    return c.json({ message: 'Settings saved' })
  } catch (error) {
    console.error('Error saving document settings:', error)
    return c.json({ error: 'Failed to save settings' }, 500)
  }
})
