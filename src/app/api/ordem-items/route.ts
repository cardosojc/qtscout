import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { canManageItem, resolveCategory, type ProfileForAuth } from '@/lib/ordem-permissions'
import { annotateItems, resolveRefs } from '@/lib/ordem-resolver'
import { isOrdemSection, validateItemData, type ItemShape, type OrdemSection } from '@/types/ordem-item'

async function validateRefs(
  shape: ItemShape,
  value: Record<string, unknown>,
  section: OrdemSection | null
): Promise<string | null> {
  const scoutIds: string[] = []
  const profileIds: string[] = []

  if (shape === 'MEMBER_REF' && typeof value.scoutId === 'string') {
    scoutIds.push(value.scoutId)
  }
  if (shape === 'NOITES_REF' && Array.isArray(value.scoutIds)) {
    for (const id of value.scoutIds) if (typeof id === 'string') scoutIds.push(id)
  }
  if (shape === 'PROFILE_REF' && typeof value.profileId === 'string') {
    profileIds.push(value.profileId)
  }
  if (shape === 'SCOUT_OR_PROFILE_REF' && typeof value.refId === 'string') {
    if (value.kind === 'scout') scoutIds.push(value.refId)
    if (value.kind === 'profile') profileIds.push(value.refId)
  }

  if (scoutIds.length > 0) {
    const found = await prisma.scout.findMany({
      where: { id: { in: scoutIds } },
      select: { id: true, section: true },
    })
    if (found.length !== scoutIds.length) return 'Membro não encontrado'
    if (section) {
      const mismatched = found.find((s) => s.section !== section)
      if (mismatched) return 'O membro selecionado pertence a outra secção'
    }
  }
  if (profileIds.length > 0) {
    const count = await prisma.profile.count({ where: { id: { in: profileIds } } })
    if (count !== profileIds.length) return 'Dirigente não encontrado'
  }

  return null
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const section = searchParams.get('section')
  const category = searchParams.get('category')
  const included = searchParams.get('included') // 'true' | 'false' | null

  const where: Prisma.OrdemItemWhereInput = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }
  if (section && isOrdemSection(section)) where.section = section
  if (category) where.category = category
  if (included === 'true') where.includedInOsId = { not: null }
  if (included === 'false') where.includedInOsId = null

  const items = await prisma.ordemItem.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })

  const refs = await resolveRefs(items)
  const annotated = annotateItems(items, refs)
  return NextResponse.json({ items: annotated })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    category?: unknown
    section?: unknown
    date?: unknown
    data?: unknown
  }

  const category = typeof body.category === 'string' ? resolveCategory(body.category) : null
  if (!category) return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })

  const section =
    body.section == null
      ? null
      : isOrdemSection(body.section)
        ? body.section
        : 'invalid'
  if (section === 'invalid') return NextResponse.json({ error: 'Secção inválida' }, { status: 400 })
  if (category.scope === 'SECTION' && !section) {
    return NextResponse.json({ error: 'Secção é obrigatória' }, { status: 400 })
  }
  if (category.scope === 'GROUP' && section) {
    return NextResponse.json({ error: 'Categoria de grupo não aceita secção' }, { status: 400 })
  }
  // BOTH: section optional, no further check here

  if (typeof body.date !== 'string' || isNaN(Date.parse(body.date))) {
    return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
  }

  const dataResult = validateItemData(category.shape, body.data)
  if (!dataResult.ok) return NextResponse.json({ error: dataResult.error }, { status: 400 })

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { role: true, roles: true, section: true },
  })
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const authProfile: ProfileForAuth = {
    role: profile.role,
    roles: profile.roles,
    section: profile.section,
  }
  if (!canManageItem(authProfile, category, section)) {
    return NextResponse.json({ error: 'Sem permissões para esta categoria/secção' }, { status: 403 })
  }

  // Validate ref existence + that referenced scouts belong to the item's section
  const refError = await validateRefs(category.shape, dataResult.value, section)
  if (refError) return NextResponse.json({ error: refError }, { status: 400 })

  const item = await prisma.ordemItem.create({
    data: {
      category: category.key,
      section,
      date: new Date(body.date),
      data: dataResult.value as Prisma.InputJsonValue,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json({ item })
}
