import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateDocumentPDF } from '@/lib/pdf-generator'
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
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true, email: true } } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const identifier = formatDocumentIdentifier(doc.type as DocumentType, doc.number, doc.year)

    const pdfBuffer = await generateDocumentPDF({
      type: doc.type,
      content: doc.content,
      identifier,
      createdAt: doc.createdAt.toISOString(),
      createdBy: { name: doc.createdBy.name, email: doc.createdBy.email },
    })

    const { searchParams } = new URL(request.url)
    const disposition = searchParams.get('download') === 'true' ? 'attachment' : 'inline'

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${identifier}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating document PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
