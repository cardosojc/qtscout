import { createBrowserClient } from '@supabase/ssr'
import { processLock } from '@supabase/supabase-js'

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Use an in-memory lock instead of the Web Locks API. navigator.locks can
      // deadlock when a lock holder is abandoned (e.g. React StrictMode
      // double-mount in dev, or a navigated-away tab), hanging getSession().
      auth: { lock: processLock },
    },
  )
}

let browserClient: ReturnType<typeof makeClient> | undefined

// Singleton browser client. `apiFetch` calls createClient() on every request;
// returning a fresh client each time spins up a new GoTrueClient, and the many
// instances then contend on the shared `sb-…-auth-token` lock — getSession()
// times out after 10s ("Lock acquisition timed out") and silently drops the
// Bearer token, so authenticated fetches never fire (empty member lists, etc.).
// One shared instance keeps lock operations serialized and fast.
export function createClient() {
  if (!browserClient) browserClient = makeClient()
  return browserClient
}

// Access-token cache. `apiFetch` reads this synchronously instead of calling
// `supabase.auth.getSession()` on every request — getSession acquires the
// gotrue auth-token lock, and when a background token refresh holds that lock a
// concurrent getSession() blocks for up to 10s ("Lock acquisition timed out"),
// silently dropping the Bearer token. The AuthProvider keeps this fresh from
// onAuthStateChange (INITIAL_SESSION + TOKEN_REFRESHED).
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}
