import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateMeetingPDF } from '@/lib/pdf-generator'

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
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        meetingType: true,
        createdBy: {
          select: { name: true, email: true }
        }
      }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Generate PDF - Transform meeting data for PDF generation
    const meetingForPDF = {
      ...meeting,
      date: meeting.date.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt?.toISOString(),
      agenda: (meeting.agenda as Record<string, unknown>) || {},
      actionItems: (meeting.actionItems as Record<string, unknown>[]) || []
    }
    const pdfBuffer = await generateMeetingPDF(meetingForPDF)

    const filename = `${meeting.identifier}.pdf`
    const { searchParams } = new URL(request.url)
    const disposition = searchParams.get('download') === 'true' ? 'attachment' : 'inline'

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}