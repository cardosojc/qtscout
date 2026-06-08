import './load-env'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { auth } from './routes/auth'
import { profile } from './routes/profile'
import { profiles } from './routes/profiles'
import { meetingTypes } from './routes/meeting-types'
import { meetings } from './routes/meetings'
import { documents } from './routes/documents'
import { scouts } from './routes/scouts'
import { ordemItems } from './routes/ordem-items'
import { ordensServico } from './routes/ordens-servico'
import { search } from './routes/search'
import { settings } from './routes/settings'
import { users } from './routes/users'
import { ai } from './routes/ai'

const app = new Hono<AppEnv>()

app.use('*', cors({
  origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.get('/health', (c) => c.json({ ok: true }))

// All domain routes live under /api so the web client only needs to swap origin.
const api = new Hono<AppEnv>()
api.get('/health', (c) => c.json({ ok: true }))
api.route('/auth', auth)
api.route('/profile', profile)
api.route('/profiles', profiles)
api.route('/meeting-types', meetingTypes)
api.route('/meetings', meetings)
api.route('/documents', documents)
api.route('/scouts', scouts)
api.route('/ordem-items', ordemItems)
api.route('/ordens-servico', ordensServico)
api.route('/search', search)
api.route('/settings', settings)
api.route('/users', users)
api.route('/ai', ai)
app.route('/api', api)

export default app
