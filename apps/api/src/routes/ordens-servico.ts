import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { formatDocumentIdentifier } from '@qtscout/core/document-utils'
import { assembleOrdemServico } from '@qtscout/core/ordem-assembler'
import { resolveRefs, scoutLabel } from '@qtscout/core/ordem-resolver'
import type { OrdemSection } from '@qtscout/types/ordem-item'
import { requireAuth, requireAdmin } from '../middleware/auth'
import type { AppEnv } from '../types'

const SECTION_KEY: Record<OrdemSection, 'alcateia' | 'expedicao' | 'comunidade' | 'cla'> = {
  ALCATEIA: 'alcateia',
  EXPEDICAO: 'expedicao',
  COMUNIDADE: 'comunidade',
  CLA: 'cla',
}

export const ordensServico = new Hono<AppEnv>()
ordensServico.use('*', requireAuth)

ordensServico.post('/generate', requireAdmin, async (c) => {
  const session = c.get('session')

  const body = (await c.req.json()) as { from?: unknown; to?: unknown }
  if (typeof body.from !== 'string' || isNaN(Date.parse(body.from))) {
    return c.json({ error: 'Data inicial inválida' }, 400)
  }
  if (typeof body.to !== 'string' || isNaN(Date.parse(body.to))) {
    return c.json({ error: 'Data final inválida' }, 400)
  }
  const from = new Date(body.from)
  const to = new Date(body.to)
  if (from > to) {
    return c.json({ error: 'Intervalo inválido' }, 400)
  }

  const [items, admittedScouts, nightsBadges] = await Promise.all([
    prisma.ordemItem.findMany({
      where: { date: { gte: from, lte: to }, includedInOsId: null },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.scout.findMany({
      where: { joinedAt: { gte: from, lte: to }, section: { not: null } },
      select: { firstName: true, lastName: true, numeroAssociado: true, section: true, joinedAt: true },
      orderBy: [{ section: 'asc' }, { joinedAt: 'asc' }],
    }),
    prisma.scoutNightsBadge.findMany({
      where: { awardedAt: { gte: from, lte: to }, scout: { section: { not: null } } },
      select: {
        count: true,
        awardedAt: true,
        scout: { select: { firstName: true, lastName: true, numeroAssociado: true, section: true } },
      },
      orderBy: [{ count: 'asc' }, { awardedAt: 'asc' }],
    }),
  ])

  if (items.length === 0 && admittedScouts.length === 0 && nightsBadges.length === 0) {
    return c.json({ error: 'Sem itens, admissões nem insígnias neste intervalo' }, 400)
  }

  const formatDate = (d: Date) => d.toISOString().slice(0, 10)
  const refs = await resolveRefs(items)
  const assembled = assembleOrdemServico(items, { de: formatDate(from), ate: formatDate(to) }, refs)

  for (const scout of admittedScouts) {
    const key = SECTION_KEY[scout.section as OrdemSection]
    if (!key) continue
    assembled.efetivo.admissao[key].push(
      scoutLabel({
        firstName: scout.firstName,
        lastName: scout.lastName,
        numeroAssociado: scout.numeroAssociado,
      }),
    )
  }

  const milestoneIndex = new Map<string, {
    count: number
    sectionKey: 'alcateia' | 'expedicao' | 'comunidade' | 'cla'
    membros: string[]
  }>()
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
      }),
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

  return c.json({
    ...document,
    identifier: formatDocumentIdentifier('ORDEM_SERVICO', document.number, document.year),
    itemCount: items.length,
    autoAdmissions: admittedScouts.length,
    autoNightsBadges: nightsBadges.length,
  })
})
