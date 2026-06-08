import { handle } from '@hono/node-server/vercel'
import app from './app'

// Entry point for the esbuild bundle that backs the Vercel Function. Everything
// reachable from here (the Hono app + the raw-TS @qtscout/* workspace packages)
// is bundled into a single file so the function has no unresolved local imports.
//
// Use the node-server Vercel adapter (not `hono/vercel`): the @vercel/node
// runtime invokes the handler with Node's (req, res), which this adapter bridges
// to the Hono app. `hono/vercel` expects a Web `Request` and would hang here.
export default handle(app)
