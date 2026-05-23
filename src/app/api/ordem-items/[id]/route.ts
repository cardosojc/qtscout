import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { canManageItem, resolveCategory, type ProfileForAuth } from '@/lib/ordem-permissions'
import { isOrdemSection, validateItemData } from '@/types/ordem-item'

type Params = { params: Promise<{ id: string }> }

async function loadAuth(userId: string): Promise<ProfileForAuth | null> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true, roles: true, section: true },
  })
  return p ? { role: p.role, roles: p.roles, section: p.section } : null
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.ordemItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  if (existing.includedInOsId) {
    return NextResponse.json({ error: 'Item já incluído numa Ordem de Serviço' }, { status: 409 })
  }

  const category = resolveCategory(existing.category)
  if (!category) return NextResponse.json({ error: 'Categoria inválida' }, { status: 500 })

  const profile = await loadAuth(session.user.id)
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const isOwner = existing.createdById === session.user.id
  if (!isOwner && profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissões' }, { status: 403 })
  }

  const body = (await request.json()) as { date?: unknown; data?: unknown; section?: unknown }

  const update: Prisma.OrdemItemUpdateInput = {}
  if (body.date !== undefined) {
    if (typeof body.date !== 'string' || isNaN(Date.parse(body.date))) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    }
    update.date = new Date(body.date)
  }
  if (body.data !== undefined) {
    const r = validateItemData(category.shape, body.data)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    update.data = r.value as Prisma.InputJsonValue
  }
  if (body.section !== undefined) {
    if (category.scope === 'GROUP') {
      return NextResponse.json({ error: 'Categoria de grupo não aceita secção' }, { status: 400 })
    }
    if (!isOrdemSection(body.section)) {
      return NextResponse.json({ error: 'Secção inválida' }, { status: 400 })
    }
    if (!canManageItem(profile, category, body.section)) {
      return NextResponse.json({ error: 'Sem permissões para essa secção' }, { status: 403 })
    }
    update.section = body.section
  }

  const item = await prisma.ordemItem.update({
    where: { id },
    data: update,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json({ item })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.ordemItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  if (existing.includedInOsId) {
    return NextResponse.json({ error: 'Item já incluído numa Ordem de Serviço' }, { status: 409 })
  }

  const profile = await loadAuth(session.user.id)
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  const isOwner = existing.createdById === session.user.id
  if (!isOwner && profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissões' }, { status: 403 })
  }

  await prisma.ordemItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
