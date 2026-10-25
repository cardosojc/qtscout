import { defineConfig, devices } from '@playwright/test'

const E2E_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@qtscout.test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
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

  // Start both the web app (:3000) and the API (:3001, uvicorn). The web proxies
  // /api/* to API_ORIGIN; the API runs with AUTH_MODE=dev as the e2e user (no
  // Cloudflare Access locally) on a throwaway SQLite database (apps/api/e2e.db),
  // recreated and seeded with that user on every run.
  webServer: [
    {
      command: 'npm run dev',
      env: { API_ORIGIN: process.env.API_ORIGIN ?? 'http://localhost:3001' },
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `uv run python scripts/local_db.py e2e.db --seed ${E2E_EMAIL} --name 'E2E Tester' --username e2e-tester && uv run uvicorn app.main:app --app-dir src --port 3001`,
      cwd: 'apps/api',
      env: { AUTH_MODE: 'dev', AUTH_DEV_EMAIL: E2E_EMAIL, DATABASE_URL: 'sqlite:///./e2e.db' },
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
