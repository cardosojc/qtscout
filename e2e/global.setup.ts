import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { TEST_USER } from './helpers/auth'

// Provisions the test user, its profile, and the meeting types directly via the
// Supabase service-role client (PostgREST), which bypasses RLS. The backend is
// now FastAPI/Python, so there is no Prisma client here anymore.
async function ensureTestData() {
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

  // 1. Upsert the auth user via the GoTrue Admin API.
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users.find((u) => u.email === TEST_USER.email)

  let userId: string
  if (existing) {
    userId = existing.id
    // Reset password in case it drifted.
    await supabase.auth.admin.updateUserById(userId, { password: TEST_USER.password })
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

  // 2. Ensure the profile row (service role bypasses RLS). `createdAt`/`updatedAt`
  //    are NOT NULL with no DB default (Prisma used to manage them in-app), so we
  //    set them explicitly. Select-then-update/insert mirrors the old Prisma
  //    upsert: update only name/role on an existing row, full insert otherwise.
  const now = new Date().toISOString()
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  const { error: profileError } = existingProfile
    ? await supabase
        .from('profiles')
        .update({ name: TEST_USER.name, role: 'ADMIN', updatedAt: now })
        .eq('id', userId)
    : await supabase.from('profiles').insert({
        id: userId,
        username: TEST_USER.username,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: 'ADMIN',
        createdAt: now,
        updatedAt: now,
      })
  if (profileError) throw new Error(`Failed to provision profile: ${profileError.message}`)

  // 3. Ensure the meeting types exist. ignoreDuplicates so an existing row's id
  //    (referenced by meetings.meetingTypeId) is never rewritten; the generated
  //    id + timestamps are only used when inserting a brand-new row.
  const { error: typesError } = await supabase.from('meeting_types').upsert(
    [
      { id: randomUUID(), code: 'CA', name: 'Conselho de Agrupamento', description: 'Reunião do conselho', createdAt: now, updatedAt: now },
      { id: randomUUID(), code: 'RD', name: 'Reunião de Direção', description: 'Reunião da direção', createdAt: now, updatedAt: now },
    ],
    { onConflict: 'code', ignoreDuplicates: true }
  )
  if (typesError) throw new Error(`Failed to upsert meeting types: ${typesError.message}`)
}

setup('create test user and authenticate', async ({ page }) => {
  // Provision test data before logging in
  await ensureTestData()

  // Sign in via the UI and persist the session
  await page.goto('/auth/signin')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()

  // Sign-in pushes to '/', and the authenticated home redirects to /meetings
  // once the profile loads from the API. Reaching /meetings therefore confirms
  // the browser -> API (Bearer) auth path works end-to-end.
  await page.waitForURL('**/meetings', { timeout: 30_000 })
  await page.getByRole('link', { name: 'Reuniões' }).first().waitFor({ timeout: 15_000 })

  await page.context().storageState({ path: '.auth/user.json' })
})
