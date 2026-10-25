// Locally there is no Cloudflare Access in front of the app: the API runs with
// AUTH_MODE=dev and treats every request as AUTH_DEV_EMAIL, which must be this
// user's email. global.setup provisions the matching profile.
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL ?? 'e2e-test@qtscout.test',
  username: 'e2e-tester',
  name: 'E2E Tester',
  role: 'ADMIN',
}
