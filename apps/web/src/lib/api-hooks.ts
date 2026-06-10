import useSWR, { preload } from 'swr'
import { apiGet } from '@/lib/api-client'
import { getAnoEscutistaRange, getCurrentAnoEscutista } from '@qtscout/core/ano-escutista'
import type { MeetingResponse } from '@qtscout/types/meeting'
import type { Document, DocumentType } from '@qtscout/types/document'
import type { Scout } from '@qtscout/types/scout'
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
