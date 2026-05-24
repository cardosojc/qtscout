import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { formatDocumentIdentifier } from '@/lib/document-utils'
import { assembleOrdemServico } from '@/lib/ordem-assembler'
import { resolveRefs, scoutLabel } from '@/lib/ordem-resolver'
import type { OrdemSection } from '@/types/ordem-item'

const SECTION_KEY: Record<OrdemSection, 'alcateia' | 'expedicao' | 'comunidade' | 'cla'> = {
  ALCATEIA: 'alcateia',
  EXPEDICAO: 'expedicao',
  COMUNIDADE: 'comunidade',
  CLA: 'cla',
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { from?: unknown; to?: unknown }
  if (typeof body.from !== 'string' || isNaN(Date.parse(body.from))) {
    return NextResponse.json({ error: 'Data inicial inválida' }, { status: 400 })
  }
  if (typeof body.to !== 'string' || isNaN(Date.parse(body.to))) {
    return NextResponse.json({ error: 'Data final inválida' }, { status: 400 })
  }
  const from = new Date(body.from)
  const to = new Date(body.to)
  if (from > to) {
    return NextResponse.json({ error: 'Intervalo inválido' }, { status: 400 })
  }

  // Only ADMIN or group-level roles should generate. Keep it admin-only for now;
  // we can relax later if needed.
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem gerar Ordens de Serviço' }, { status: 403 })
  }

  const [items, admittedScouts, nightsBadges] = await Promise.all([
    prisma.ordemItem.findMany({
      where: {
        date: { gte: from, lte: to },
        includedInOsId: null,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.scout.findMany({
      where: {
        joinedAt: { gte: from, lte: to },
        section: { not: null },
      },
      select: { firstName: true, lastName: true, numeroAssociado: true, section: true, joinedAt: true },
      orderBy: [{ section: 'asc' }, { joinedAt: 'asc' }],
    }),
    prisma.scoutNightsBadge.findMany({
      where: {
        awardedAt: { gte: from, lte: to },
        scout: { section: { not: null } },
      },
      select: {
        count: true,
        awardedAt: true,
        scout: { select: { firstName: true, lastName: true, numeroAssociado: true, section: true } },
      },
      orderBy: [{ count: 'asc' }, { awardedAt: 'asc' }],
    }),
  ])

  if (items.length === 0 && admittedScouts.length === 0 && nightsBadges.length === 0) {
    return NextResponse.json(
      { error: 'Sem itens, admissões nem insígnias neste intervalo' },
      { status: 400 }
    )
  }

  const formatDate = (d: Date) => d.toISOString().slice(0, 10)
  const refs = await resolveRefs(items)
  const assembled = assembleOrdemServico(items, { de: formatDate(from), ate: formatDate(to) }, refs)

  // Auto-include admissões from Scout.joinedAt (scouts without section are skipped)
  for (const scout of admittedScouts) {
    const key = SECTION_KEY[scout.section as OrdemSection]
    if (!key) continue
    assembled.efetivo.admissao[key].push(
      scoutLabel({
        firstName: scout.firstName,
        lastName: scout.lastName,
        numeroAssociado: scout.numeroAssociado,
      })
    )
  }

  // Auto-include noites de campo milestones, grouped by (section, count).
  // Each section ends up with a list of milestone entries, each carrying the
  // names of the scouts that crossed that threshold in the period.
  const milestoneIndex = new Map<string, { count: number; sectionKey: 'alcateia' | 'expedicao' | 'comunidade' | 'cla'; membros: string[] }>()
  for (const badge of nightsBadges) {
    const section = badge.scout.section
    if (!section) continue
    const sectionKey = SECTION_KEY[section as OrdemSection]
    const k = `${sectionKey}:${badge.count}`
    if (!milestoneIndex.has(k)) {
      milestoneIndex.set(k, { count: badge.count, sectionKey, membros: [] })
    }
    milestoneIndex.get(k)!.membros.push(
      scoutLabel({
        firstName: badge.scout.firstName,
        lastName: badge.scout.lastName,
        numeroAssociado: badge.scout.numeroAssociado,
      })
    )
  }
  for (const { count, sectionKey, membros } of milestoneIndex.values()) {
    assembled.noitesCampo[sectionKey].push({ count, membros })
  }

  const document = await prisma.$transaction(async (tx) => {
    const settings = await tx.documentSettings.findUnique({ where: { type: 'ORDEM_SERVICO' } })
    const startingNumber = settings?.startingNumber ?? 1
    const sequence = await tx.documentSequence.upsert({
      where: { type_year: { type: 'ORDEM_SERVICO', year: 0 } },
      create: { type: 'ORDEM_SERVICO', year: 0, currentNumber: startingNumber },
      update: { currentNumber: { increment: 1 } },
    })

    const doc = await tx.document.create({
      data: {
        type: 'ORDEM_SERVICO',
        number: sequence.currentNumber,
        year: null,
        content: JSON.stringify(assembled),
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    await tx.ordemItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { includedInOsId: doc.id },
    })

    return doc
  })

  return NextResponse.json({
    ...document,
    identifier: formatDocumentIdentifier('ORDEM_SERVICO', document.number, document.year),
    itemCount: items.length,
    autoAdmissions: admittedScouts.length,
    autoNightsBadges: nightsBadges.length,
  })
}
