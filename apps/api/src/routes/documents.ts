import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { generateDocumentPDF } from '@qtscout/core/pdf-generator'
import { formatDocumentIdentifier } from '@qtscout/core/document-utils'
import type { DocumentType } from '@qtscout/types/document'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { pdfResponse } from '../lib/pdf-response'
import type { AppEnv } from '../types'

export const documents = new Hono<AppEnv>()
documents.use('*', requireAuth)

documents.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const typeParam = (c.req.query('type') as DocumentType | undefined) ?? null
    const fromParam = c.req.query('from')
    const toParam = c.req.query('to')
    const skip = (page - 1) * limit

    const dateFilter = (fromParam || toParam) ? {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam) } : {}),
    } : undefined
    const where = {
      ...(typeParam ? { type: typeParam } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ])

    const documentsWithIdentifier = documents.map((doc) => ({
      ...doc,
      identifier: formatDocumentIdentifier(doc.type as DocumentType, doc.number, doc.year),
    }))

    return c.json({
      documents: documentsWithIdentifier,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
})

documents.post('/', async (c) => {
  try {
    const session = c.get('session')
    const body = await c.req.json()
    const { type, content } = body as { type: DocumentType; content: string }

    if (!type || !['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO'].includes(type)) {
      return c.json({ error: 'Invalid document type' }, 400)
    }

    const currentYear = new Date().getFullYear()
    const documentYear = type === 'ORDEM_SERVICO' ? null : currentYear
    const seqYear = type === 'ORDEM_SERVICO' ? 0 : currentYear

    const document = await prisma.$transaction(async (tx) => {
      const settings = await tx.documentSettings.findUnique({ where: { type } })
      const startingNumber = settings?.startingNumber ?? 1

      // `startingNumber` acts as a floor: the next document is at least
      // `startingNumber`, otherwise one past the last assigned number. This
      // lets an admin raise the starting number even after a sequence exists.
      const existing = await tx.documentSequence.findUnique({
        where: { type_year: { type, year: seqYear } },
      })
      const nextNumber = existing
        ? Math.max(existing.currentNumber + 1, startingNumber)
        : startingNumber

      const sequence = await tx.documentSequence.upsert({
        where: { type_year: { type, year: seqYear } },
        create: { type, year: seqYear, currentNumber: nextNumber },
        update: { currentNumber: nextNumber },
      })

      return tx.document.create({
        data: {
          type,
          number: sequence.currentNumber,
          year: documentYear,
          content: content ?? '',
          createdById: session.user.id,
        },
        include: { createdBy: { select: { name: true, email: true } } },
      })
    })

    return c.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error creating document:', error)
    return c.json({ error: 'Failed to create document' }, 500)
  }
})

documents.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        signedBy: { select: { id: true, name: true, email: true, signature: true, roles: true } },
      },
    })
    if (!document) return c.json({ error: 'Document not found' }, 404)
    return c.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return c.json({ error: 'Failed to fetch document' }, 500)
  }
})

documents.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { content } = body as { content: string }

    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Document not found' }, 404)

    const document = await prisma.document.update({
      where: { id },
      data: { content },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    return c.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error updating document:', error)
    return c.json({ error: 'Failed to update document' }, 500)
  }
})

documents.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Document not found' }, 404)
    await prisma.document.delete({ where: { id } })
    return c.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    return c.json({ error: 'Failed to delete document' }, 500)
  }
})

documents.get('/:id/pdf', async (c) => {
  try {
    const id = c.req.param('id')
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        signedBy: { select: { name: true, email: true, signature: true, roles: true } },
      },
    })
    if (!doc) return c.json({ error: 'Document not found' }, 404)

    const identifier = formatDocumentIdentifier(doc.type as DocumentType, doc.number, doc.year)

    const pdfBuffer = await generateDocumentPDF({
      type: doc.type,
      content: doc.content,
      identifier,
      createdAt: doc.createdAt.toISOString(),
      createdBy: { name: doc.createdBy.name, email: doc.createdBy.email },
      signedAt: doc.signedAt?.toISOString() ?? null,
      signedBy: doc.signedBy
        ? {
            name: doc.signedBy.name,
            email: doc.signedBy.email,
            signature: doc.signedBy.signature,
            roles: doc.signedBy.roles,
          }
        : null,
    })

    const disposition = c.req.query('download') === 'true' ? 'attachment' : 'inline'
    return pdfResponse(c, pdfBuffer, `${identifier}.pdf`, disposition)
  } catch (error) {
    console.error('Error generating document PDF:', error)
    return c.json({ error: 'Failed to generate PDF' }, 500)
  }
})

documents.post('/:id/sign', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { signature: true },
  })
  if (!profile?.signature) {
    return c.json({ error: 'Carregue uma assinatura no seu perfil antes de assinar.' }, 400)
  }

  const document = await prisma.document.findUnique({ where: { id }, select: { id: true, signedById: true } })
  if (!document) return c.json({ error: 'Documento não encontrado' }, 404)
  if (document.signedById) return c.json({ error: 'Documento já assinado' }, 409)

  await prisma.document.update({
    where: { id },
    data: { signedById: session.user.id, signedAt: new Date() },
  })
  return c.json({ ok: true })
})

documents.delete('/:id/sign', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')

  const document = await prisma.document.findUnique({ where: { id }, select: { signedById: true } })
  if (!document) return c.json({ error: 'Documento não encontrado' }, 404)
  if (!document.signedById) return c.json({ ok: true })

  if (document.signedById !== session.user.id && session.user.role !== 'ADMIN') {
    return c.json({ error: 'Apenas o signatário ou um administrador podem remover a assinatura.' }, 403)
  }

  await prisma.document.update({
    where: { id },
    data: { signedById: null, signedAt: null },
  })
  return c.json({ ok: true })
})
