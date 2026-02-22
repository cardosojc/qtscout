import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { formatDocumentIdentifier } from '@/lib/document-utils'
import type { DocumentType } from '@/types/document'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { content } = body as { content: string }

    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const document = await prisma.document.update({
      where: { id },
      data: { content },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({
      ...document,
      identifier: formatDocumentIdentifier(document.type as DocumentType, document.number, document.year),
    })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
