/**
 * Lightweight client-side full-text matching for inline list filtering.
 * Accent- and case-insensitive, token-based (every term must appear).
 */

/** Lowercase and strip diacritics so "joao" matches "João". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * True if every whitespace-separated term in `query` is a substring of
 * `haystack` (after normalization). An empty/blank query matches everything.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeText(query).trim()
  if (!q) return true
  const hay = normalizeText(haystack)
  return q.split(/\s+/).every((term) => hay.includes(term))
}
