import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load env so Supabase/DB vars are available in setup and tests. The single
// source of truth lives in the web app during the monorepo transition.
dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') })

// Point the suite at a deployed app with PLAYWRIGHT_BASE_URL (e.g. the Vercel
// prod URL). When set, we do not start the local web/API servers.
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = remoteBaseURL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start both the web app (:3000) and the FastAPI backend (:3001) locally. The
  // web's NEXT_PUBLIC_API_URL must point at http://localhost:3001 (apps/web/
  // .env.local locally; the job env in CI). Skipped when targeting a remote app.
  webServer: remoteBaseURL
    ? undefined
    : [
        {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
        {
          command: 'uv run uvicorn app.main:app --port 3001',
          cwd: 'apps/api',
          url: 'http://localhost:3001/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
})
