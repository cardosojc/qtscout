import type { OrdemItem } from '@prisma/client'
import { prisma } from '@qtscout/db'

export type ResolvedRef = {
  scouts: Map<string, { id: string; firstName: string; lastName: string; numeroAssociado: string | null }>
  profiles: Map<string, { id: string; name: string | null; email: string }>
}

function extractIds(items: OrdemItem[]): { scoutIds: Set<string>; profileIds: Set<string> } {
  const scoutIds = new Set<string>()
  const profileIds = new Set<string>()
  for (const item of items) {
    const d = (item.data ?? {}) as Record<string, unknown>
    if (typeof d.scoutId === 'string') scoutIds.add(d.scoutId)
    if (typeof d.profileId === 'string') profileIds.add(d.profileId)
    if (Array.isArray(d.scoutIds)) {
      for (const id of d.scoutIds) if (typeof id === 'string') scoutIds.add(id)
    }
    if (typeof d.kind === 'string' && typeof d.refId === 'string') {
      if (d.kind === 'scout') scoutIds.add(d.refId)
      else if (d.kind === 'profile') profileIds.add(d.refId)
    }
  }
  return { scoutIds, profileIds }
}

export async function resolveRefs(items: OrdemItem[]): Promise<ResolvedRef> {
  const { scoutIds, profileIds } = extractIds(items)

  const [scoutRows, profileRows] = await Promise.all([
    scoutIds.size > 0
      ? prisma.scout.findMany({
          where: { id: { in: Array.from(scoutIds) } },
          select: { id: true, firstName: true, lastName: true, numeroAssociado: true },
        })
      : Promise.resolve([]),
    profileIds.size > 0
      ? prisma.profile.findMany({
          where: { id: { in: Array.from(profileIds) } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ])

  return {
    scouts: new Map(scoutRows.map((s) => [s.id, s])),
    profiles: new Map(profileRows.map((p) => [p.id, p])),
  }
}

export function scoutLabel(s: { firstName: string; lastName: string; numeroAssociado?: string | null } | undefined): string {
  if (!s) return '—'
  const name = `${s.firstName} ${s.lastName}`.trim()
  return s.numeroAssociado ? `${name} (${s.numeroAssociado})` : name
}

export function profileLabel(p: { name: string | null; email: string } | undefined): string {
  if (!p) return '—'
  return p.name || p.email
}

/**
 * Annotate item.data with a `_display` field containing resolved names. Useful
 * for client consumption so the UI doesn't need to round-trip per item.
 */
export function annotateItems(items: OrdemItem[], refs: ResolvedRef) {
  return items.map((item) => {
    const d = (item.data ?? {}) as Record<string, unknown>
    const display: Record<string, unknown> = {}
    if (typeof d.scoutId === 'string') {
      display.scout = scoutLabel(refs.scouts.get(d.scoutId))
    }
    if (typeof d.profileId === 'string') {
      display.profile = profileLabel(refs.profiles.get(d.profileId))
    }
    if (Array.isArray(d.scoutIds)) {
      display.scouts = d.scoutIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => scoutLabel(refs.scouts.get(id)))
    }
    if (typeof d.kind === 'string' && typeof d.refId === 'string') {
      display.ref =
        d.kind === 'scout'
          ? scoutLabel(refs.scouts.get(d.refId))
          : d.kind === 'profile'
            ? profileLabel(refs.profiles.get(d.refId))
            : '—'
    }
    return { ...item, data: { ...d, _display: display } }
  })
}
