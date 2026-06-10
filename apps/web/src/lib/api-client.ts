import { createClient } from '@/lib/supabase/client'

// Base origin of the standalone API service. Routes live under /api, so callers
// keep passing `/api/...` paths and only the origin is prepended.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * fetch() wrapper that targets the standalone API and attaches the Supabase
 * access token as a Bearer header. Drop-in for the previous relative
 * `fetch('/api/...')` calls — pass the same `/api/...` path and init.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  for (const [k, v] of Object.entries(await authHeader())) {
    headers.set(k, v)
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

export class ApiError extends Error {
  status: number
  info: unknown
  constructor(status: number, message: string, info?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.info = info
  }
}

/**
 * JSON GET helper used as the SWR fetcher. Resolves with the parsed body or
 * throws `ApiError` on a non-2xx response so SWR surfaces it as `error`.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) {
    const info = await res.json().catch(() => undefined)
    throw new ApiError(res.status, `GET ${path} failed (${res.status})`, info)
  }
  return res.json() as Promise<T>
}
