import { serve } from '@hono/node-server'
import app from './app'

// Local dev / self-hosted entry: bind a port. On Vercel the app is served via
// the function in `api/[...route].ts` instead, which imports `./app` directly.
const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`@qtscout/api listening on http://localhost:${info.port}`)
})

export default app
