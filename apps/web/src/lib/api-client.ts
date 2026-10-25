// The API is served on the same origin under /api (next.config rewrites it to
// the API service), behind the same Cloudflare Access application as the web.
// The browser therefore sends the Access session cookie on every call and Access
// adds its signed JWT header — there is no token for the client to manage.

/**
 * Same-origin fetch to the API. Pass `/api/...` paths.
 *
 * When the Access session has expired, Access answers API calls with a redirect
 * to its (cross-origin) login page, which fetch cannot follow. Requests use
 * `redirect: 'manual'` so that shows up as an opaque redirect; we retry once
 * following redirects (covers ordinary same-origin redirects such as trailing
 * slashes) and, if that still cannot complete, reload the page so the browser
 * goes through the Access login and comes back.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, credentials: 'same-origin', redirect: 'manual' })
  if (res.type !== 'opaqueredirect') return res
  try {
    return await fetch(path, { ...init, credentials: 'same-origin' })
  } catch (err) {
    if (typeof window !== 'undefined') window.location.reload()
    throw err
  }
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
