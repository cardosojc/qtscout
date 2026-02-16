import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'prisma/config'
import { loadEnvFile } from 'node:process'

const envPath = path.join(__dirname, '.env')
const envLocalPath = path.join(__dirname, '.env.local')

if (fs.existsSync(envPath)) {
  loadEnvFile(envPath)
} else if (fs.existsSync(envLocalPath)) {
  loadEnvFile(envLocalPath)
}

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
