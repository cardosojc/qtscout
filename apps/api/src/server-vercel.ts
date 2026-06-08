import { handle } from 'hono/vercel'
import app from './app'

// Entry point for the esbuild bundle that backs the Vercel Function. Everything
// reachable from here (the Hono app + the raw-TS @qtscout/* workspace packages)
// is bundled into a single file so the function has no unresolved local imports.
export default handle(app)
