import { handle } from 'hono/vercel'
import app from '../src/app'

// Vercel Function entry. The `api/` directory + catch-all routes every
// incoming `/api/*` request to the Hono app, which already mounts its routes
// under `/api`, so `req.url` matches the app's paths unchanged.
export const config = {
  maxDuration: 60,
}

export default handle(app)
