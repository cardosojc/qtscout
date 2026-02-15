import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { loadEnvFile } from 'node:process'

loadEnvFile(path.join(__dirname, '.env'))

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  seed: {
    command: 'tsx prisma/seed.ts',
  },
})
