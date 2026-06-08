import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'prisma/config'
import { loadEnvFile } from 'node:process'

// Single source of truth for env lives in the web app during the transition;
// fall back to a repo-root env file if present.
const candidates = [
  path.join(__dirname, '..', '..', 'apps', 'web', '.env.local'),
  path.join(__dirname, '..', '..', 'apps', 'web', '.env'),
  path.join(__dirname, '..', '..', '.env.local'),
  path.join(__dirname, '..', '..', '.env'),
]

for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    loadEnvFile(envPath)
    break
  }
}

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
