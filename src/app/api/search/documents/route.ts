import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { formatDocumentIdentifier } from '@/lib/document-utils'
import type { DocumentType } from '@/types/document'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const typeParam = searchParams.get('type') as DocumentType | null
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    if (typeParam) where.type = typeParam
    if (query) where.content = { contains: query, mode: 'insensitive' }
    if (dateFrom || dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const orderBy =
      sortBy === 'identifier'
        ? [{ type: sortOrder }, { number: sortOrder }]
        : { createdAt: sortOrder }

    const documents = await prisma.document.findMany({
      where,
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy,
      take: 50,
    })

    return NextResponse.json(
      documents.map((doc) => ({
        ...doc,
        identifier: formatDocumentIdentifier(doc.type as DocumentType, doc.number, doc.year),
      }))
    )
  } catch (error) {
    console.error('Error searching documents:', error)
    return NextResponse.json({ error: 'Failed to search documents' }, { status: 500 })
  }
}
