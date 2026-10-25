import useSWR, { mutate, preload } from 'swr'
import { apiGet, ApiError } from '@/lib/api-client'
import { getAnoEscutistaRange, getCurrentAnoEscutista } from '@qtscout/types/ano-escutista'
import type {
  DocumentOut as Document,
  LeaderProfileOut,
  MeetingListResponse as MeetingResponse,
  MeetingOut,
  MeetingTypeOut,
  NightsBadgeOut,
  ScoutCampNightsOut,
  ScoutOut as Scout,
} from '@/lib/api-schemas'
import type { DocumentType } from '@qtscout/types/document'
import type { OrdemSection } from '@qtscout/types/ordem-item'

type Pagination = { page: number; limit: number; total: number; totalPages: number }

// Each `*Key` builder is the single source of truth for an endpoint's SWR key,
// so the hook and its preload helper always produce byte-identical keys (and
// therefore hit the same cache entry).

// ---- Meetings ----
function meetingsKey(p: { page: number; limit?: number; from?: string; to?: string }) {
  const sp = new URLSearchParams({ page: String(p.page), limit: String(p.limit ?? 10) })
  if (p.from) sp.set('from', p.from)
  if (p.to) sp.set('to', p.to)
  return `/api/meetings?${sp}`
}

export function useMeetings(
  p: { page: number; from?: string; to?: string },
  enabled = true,
) {
  return useSWR<MeetingResponse>(enabled ? meetingsKey(p) : null)
}

// ---- Documents ----
type DocumentsResponse = { documents: Document[]; pagination: Pagination }

function documentsKey(p: { type: DocumentType; page: number; limit?: number; from?: string; to?: string }) {
  const sp = new URLSearchParams({ type: p.type, page: String(p.page), limit: String(p.limit ?? 10) })
  if (p.from) sp.set('from', p.from)
  if (p.to) sp.set('to', p.to)
  return `/api/documents?${sp}`
}

export function useDocuments(
  p: { type: DocumentType; page: number; from?: string; to?: string },
  enabled = true,
) {
  return useSWR<DocumentsResponse>(enabled ? documentsKey(p) : null)
}

// ---- Scouts ----
type ScoutsResponse = { scouts: Scout[] }

function scoutsKey(p: { section?: OrdemSection | ''; includeInactive?: boolean }) {
  const sp = new URLSearchParams()
  if (p.section) sp.set('section', p.section)
  if (p.includeInactive) sp.set('includeInactive', 'true')
  return `/api/scouts?${sp.toString()}`
}

export function useScouts(
  p: { section?: OrdemSection | ''; includeInactive?: boolean },
  enabled = true,
) {
  return useSWR<ScoutsResponse>(enabled ? scoutsKey(p) : null)
}

// ---- Single records ----
/**
 * Refetch a cached entry after a write, keeping the current data meanwhile (so
 * a page still showing it, like an open edit form, doesn't drop to loading).
 * Await it before navigating to a page that shows the entry.
 */
export function refreshCached(key: string) {
  return mutate(key)
}

// Detail pages must never show the previous record while the next one loads,
// so these opt out of the app-wide keepPreviousData.
const DETAIL = { keepPreviousData: false } as const

/** Message for a failed load: 404 gets its own text, anything else the generic one. */
export function loadErrorMessage(error: unknown, notFound: string, generic: string): string | null {
  if (!error) return null
  return error instanceof ApiError && error.status === 404 ? notFound : generic
}

export const documentKey = (id: string) => `/api/documents/${id}`
export function useDocument<T = Document>(id: string | undefined, enabled = true) {
  return useSWR<T>(enabled && id ? documentKey(id) : null, DETAIL)
}

export const meetingKey = (id: string) => `/api/meetings/${id}`
export function useMeeting(id: string | undefined, enabled = true) {
  return useSWR<MeetingOut>(enabled && id ? meetingKey(id) : null, DETAIL)
}

export const scoutKey = (id: string) => `/api/scouts/${id}`
export function useScout<T = Scout>(id: string | undefined, enabled = true) {
  return useSWR<{ scout: T }>(enabled && id ? scoutKey(id) : null, DETAIL)
}

// Camp nights imported from SIIE ("Atividades por Elemento").
export const campNightTotalsKey = '/api/scouts/camp-nights'
export function useCampNightTotals(enabled = true) {
  return useSWR<{ totals: Record<string, number> }>(enabled ? campNightTotalsKey : null)
}

export const campNightsKey = (scoutId: string) => `/api/scouts/${scoutId}/camp-nights`
export function useScoutCampNights(scoutId: string | undefined) {
  return useSWR<ScoutCampNightsOut>(scoutId ? campNightsKey(scoutId) : null, DETAIL)
}

export function useNightsBadges(scoutId: string) {
  return useSWR<{ badges: NightsBadgeOut[] }>(`/api/scouts/${scoutId}/nights-badges`, DETAIL)
}

// ---- Reference data ----
export function useMeetingTypes(enabled = true) {
  return useSWR<MeetingTypeOut[]>(enabled ? '/api/meeting-types' : null)
}

export function useLeaders(enabled = true) {
  return useSWR<{ profiles: LeaderProfileOut[] }>(enabled ? '/api/profiles/leaders' : null)
}

// ---- Admin settings ----
export const documentSettingsKey = '/api/settings/documents'
export function useDocumentSettings<T>(enabled = true) {
  return useSWR<{ settings: T[] }>(enabled ? documentSettingsKey : null)
}

export const usersKey = '/api/users'
export function useUsers<T>(enabled = true) {
  return useSWR<{ users: T[] }>(enabled ? usersKey : null)
}

// ---- Prefetch helpers (warm the cache on sidebar hover) ----
// These mirror each page's *initial* key (page 1, current ano escutista) so the
// destination page usually renders straight from cache on click.
function defaultRange() {
  const r = getAnoEscutistaRange(getCurrentAnoEscutista().startYear)
  return { from: r.from, to: r.to }
}

export function preloadMeetings() {
  preload(meetingsKey({ page: 1, ...defaultRange() }), apiGet)
}

export function preloadDocuments(type: DocumentType) {
  preload(documentsKey({ type, page: 1, ...defaultRange() }), apiGet)
}

export function preloadScouts() {
  preload(scoutsKey({}), apiGet)
}
