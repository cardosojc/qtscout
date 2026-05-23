import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { formatDocumentIdentifier } from '@/lib/document-utils'
import { assembleOrdemServico } from '@/lib/ordem-assembler'

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

  const items = await prisma.ordemItem.findMany({
    where: {
      date: { gte: from, lte: to },
      includedInOsId: null,
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  if (items.length === 0) {
    return NextResponse.json({ error: 'Sem itens neste intervalo' }, { status: 400 })
  }

  const formatDate = (d: Date) => d.toISOString().slice(0, 10)
  const assembled = assembleOrdemServico(items, { de: formatDate(from), ate: formatDate(to) })

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
  })
}
