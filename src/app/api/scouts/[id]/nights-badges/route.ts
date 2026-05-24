import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { isNightsBadgeCount, NIGHTS_BADGE_COUNTS } from '@/types/scout'

type Params = { params: Promise<{ id: string }> }

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const badges = await prisma.scoutNightsBadge.findMany({
    where: { scoutId: id },
    select: { count: true, awardedAt: true },
    orderBy: { count: 'asc' },
  })
  return NextResponse.json({ badges })
}

/**
 * Replaces the full set of badges for the scout. Body shape:
 *   { badges: { count: number, awardedAt: string | null }[] }
 * `awardedAt: null` removes the badge if it exists; otherwise upsert.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })
  }

  const { id } = await params

  const scout = await prisma.scout.findUnique({ where: { id }, select: { id: true } })
  if (!scout) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const body = (await request.json()) as { badges?: unknown }
  if (!Array.isArray(body.badges)) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const toDelete: number[] = []
  const toUpsert: { count: number; awardedAt: Date }[] = []

  for (const raw of body.badges) {
    if (raw === null || typeof raw !== 'object') continue
    const entry = raw as { count?: unknown; awardedAt?: unknown }
    if (!isNightsBadgeCount(entry.count)) {
      return NextResponse.json({ error: `count inválido (${entry.count})` }, { status: 400 })
    }
    if (entry.awardedAt == null || entry.awardedAt === '') {
      toDelete.push(entry.count)
      continue
    }
    const date = parseDate(entry.awardedAt)
    if (!date) {
      return NextResponse.json({ error: `Data inválida para ${entry.count}` }, { status: 400 })
    }
    toUpsert.push({ count: entry.count, awardedAt: date })
  }

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [
          prisma.scoutNightsBadge.deleteMany({
            where: { scoutId: id, count: { in: toDelete } },
          }),
        ]
      : []),
    ...toUpsert.map((b) =>
      prisma.scoutNightsBadge.upsert({
        where: { scoutId_count: { scoutId: id, count: b.count } },
        create: { scoutId: id, count: b.count, awardedAt: b.awardedAt },
        update: { awardedAt: b.awardedAt },
      })
    ),
  ])

  const badges = await prisma.scoutNightsBadge.findMany({
    where: { scoutId: id },
    select: { count: true, awardedAt: true },
    orderBy: { count: 'asc' },
  })
  return NextResponse.json({ badges, allCounts: NIGHTS_BADGE_COUNTS })
}
