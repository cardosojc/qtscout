import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { canManageItem, resolveCategory, type ProfileForAuth } from '@/lib/ordem-permissions'
import { isOrdemSection, validateItemData } from '@/types/ordem-item'

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

  return NextResponse.json({ items })
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
