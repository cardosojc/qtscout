import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import type { AppEnv } from '../types'

export const meetingTypes = new Hono<AppEnv>()

// Public (matches the original route, which performs no session check).
meetingTypes.get('/', async (c) => {
  try {
    const meetingTypes = await prisma.meetingType.findMany({ orderBy: { name: 'asc' } })
    return c.json(meetingTypes)
  } catch (error) {
    console.error('Error fetching meeting types:', error)
    return c.json({ error: 'Failed to fetch meeting types' }, 500)
  }
})
