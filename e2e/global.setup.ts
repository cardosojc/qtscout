import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { TEST_USER } from './helpers/auth'

async function ensureTestUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. ' +
      'Set them in .env.local (local) or GitHub Secrets (CI).'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const prisma = new PrismaClient()

  try {
    // 1. Upsert auth user via Supabase Admin API
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users.find((u) => u.email === TEST_USER.email)

    let userId: string

    if (existing) {
      userId = existing.id
      // Reset password in case it drifted
      await supabase.auth.admin.updateUserById(userId, {
        password: TEST_USER.password,
      })
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: TEST_USER.email,
        password: TEST_USER.password,
        email_confirm: true,
        user_metadata: { name: TEST_USER.name, username: TEST_USER.username },
      })
      if (error) throw new Error(`Failed to create test user: ${error.message}`)
      userId = data.user.id
    }

    // 2. Upsert profile in database
    await prisma.profile.upsert({
      where: { id: userId },
      update: { name: TEST_USER.name, role: 'ADMIN' },
      create: {
        id: userId,
        username: TEST_USER.username,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: 'ADMIN',
      },
    })

    // 3. Ensure meeting types exist
    await prisma.meetingType.upsert({
      where: { code: 'CA' },
      update: {},
      create: { code: 'CA', name: 'Conselho de Agrupamento', description: 'Reunião do conselho' },
    })
    await prisma.meetingType.upsert({
      where: { code: 'RD' },
      update: {},
      create: { code: 'RD', name: 'Reunião de Direção', description: 'Reunião da direção' },
    })
  } finally {
    await prisma.$disconnect()
  }
}

setup('create test user and authenticate', async ({ page }) => {
  // Provision test data before logging in
  await ensureTestUser()

  // Sign in via the UI and persist the session
  await page.goto('/auth/signin')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()

  await page.waitForURL('/')
  await page.getByText(`Bem-vindo, ${TEST_USER.name}`).waitFor({ timeout: 10_000 })

  await page.context().storageState({ path: '.auth/user.json' })
})
