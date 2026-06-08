import { createMiddleware } from 'hono/factory'
import { bearerFromHeader, getSessionFromToken } from '@qtscout/auth'
import type { AppEnv } from '../types'

/** Require a valid Supabase Bearer token; attaches the hydrated session to ctx. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerFromHeader(c.req.header('Authorization'))
  const session = await getSessionFromToken(token)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('session', session)
  await next()
})

/** Require ADMIN role. Must run after requireAuth. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('session').user.role !== 'ADMIN') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
