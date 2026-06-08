import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'

// Must be imported FIRST (before @qtscout/db) so DATABASE_URL is set before the
// Prisma client is instantiated. During the transition the single source of
// truth lives in the web app; fall back to api-local or repo-root env files.
//
// On Vercel (and inside the bundled CJS function) env vars come from the
// platform and `import.meta.url` is unavailable, so skip file loading entirely.
const metaUrl = import.meta.url
if (metaUrl && metaUrl.startsWith('file:')) {
  const here = path.dirname(fileURLToPath(metaUrl))
  const candidates = [
    path.join(here, '..', '.env.local'),
    path.join(here, '..', '.env'),
    path.join(here, '..', '..', 'web', '.env.local'),
    path.join(here, '..', '..', 'web', '.env'),
    path.join(here, '..', '..', '..', '.env.local'),
    path.join(here, '..', '..', '..', '.env'),
  ]

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      loadEnvFile(envPath)
      break
    }
  }
}
