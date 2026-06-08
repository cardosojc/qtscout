import type { Session } from '@qtscout/auth'

/** Hono context env: authenticated routes always have a non-null session. */
export type AppEnv = {
  Variables: {
    session: NonNullable<Session>
  }
}
