import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { formatDocumentIdentifier } from '@/lib/document-utils'
import type { DocumentType } from '@/types/document'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const typeParam = searchParams.get('type') as DocumentType | null
    const skip = (page - 1) * limit

    const where = typeParam ? { type: typeParam } : {}

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          createdBy: { select: { name: true, email: true } },
        },
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

    return NextResponse.json({
      documents: documentsWithIdentifier,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, content } = body as { type: DocumentType; content: string }

    if (!type || !['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO'].includes(type)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()
    // Document.year is null for ORDEM_SERVICO (stored in DB), and the real year for others
    const documentYear = type === 'ORDEM_SERVICO' ? null : currentYear
    // DocumentSequence uses year=0 as a sentinel for ORDEM_SERVICO (avoids null unique constraint issues)
    const seqYear = type === 'ORDEM_SERVICO' ? 0 : currentYear

    const document = await prisma.$transaction(async (tx) => {
      const settings = await tx.documentSettings.findUnique({ where: { type } })
      const startingNumber = settings?.startingNumber ?? 1

      // Upsert the sequence — create at startingNumber, or increment if it already exists
      const sequence = await tx.documentSequence.upsert({
        where: { type_year: { type, year: seqYear } },
        create: { type, year: seqYear, currentNumber: startingNumber },
        update: { currentNumber: { increment: 1 } },
      })

      return tx.document.create({
        data: {
          type,
          number: sequence.currentNumber,
          year: documentYear,
          content: content ?? '',
          createdById: session.user.id,
        },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      })
    })

    return NextResponse.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
