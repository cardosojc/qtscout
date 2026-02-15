import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

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
        },
        attendees: {
          include: {
            profile: {
              select: { name: true, email: true }
            }
          }
        }
      }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error fetching meeting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting' },
      { status: 500 }
    )
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

    const body = await request.json()
    const {
      meetingTypeId,
      date,
      startTime,
      endTime,
      location,
      agenda,
      content,
      actionItems,
      attendees,
      chefeAgrupamento,
      secretario
    } = body

    const { id } = await params
    
    // Check if meeting exists and user has permission
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        meetingType: true
      }
    })

    if (!existingMeeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // For now, allow any authenticated user to edit
    // In production, you might want to add role-based permissions

    // If meeting type or date changed, regenerate identifier
    let updateData: any = {
      meetingTypeId: meetingTypeId || undefined,
      date: date ? new Date(date) : undefined,
      startTime,
      endTime,
      location,
      agenda,
      content,
      actionItems,
    }

    // Generate new identifier if meetingType or date changed
    if (meetingTypeId || date) {
      const finalMeetingTypeId = meetingTypeId || existingMeeting.meetingTypeId
      const finalDate = date ? new Date(date) : new Date(existingMeeting.date)

      const meetingType = await prisma.meetingType.findUnique({
        where: { id: finalMeetingTypeId }
      })

      if (meetingType) {
        const year = finalDate.getFullYear()
        const month = (finalDate.getMonth() + 1).toString().padStart(2, '0')
        const day = finalDate.getDate().toString().padStart(2, '0')
        updateData.identifier = `${meetingType.code}-${year}${month}${day}`
      }
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: updateData,
      include: {
        meetingType: true,
        createdBy: {
          select: { name: true, email: true }
        },
        attendees: {
          include: {
            profile: {
              select: { name: true, email: true }
            }
          }
        }
      }
    })

    // Update attendees and special roles in agenda
    if (attendees !== undefined || chefeAgrupamento !== undefined || secretario !== undefined || agenda !== undefined) {
      // Get current agenda data and update with new roles, attendees, and agenda items
      const currentAgenda = updateData.agenda || updatedMeeting.agenda as any

      let existingItems = []
      let existingAttendees = []
      let existingChefe = ''
      let existingSecretario = ''

      // Handle both old format (array) and new format (object)
      if (Array.isArray(currentAgenda)) {
        existingItems = currentAgenda
      } else if (currentAgenda && typeof currentAgenda === 'object') {
        existingItems = currentAgenda.items || []
        existingAttendees = currentAgenda.attendeeNames || []
        existingChefe = currentAgenda.chefeAgrupamento || ''
        existingSecretario = currentAgenda.secretario || ''
      }

      const agendaData = {
        items: agenda !== undefined ? agenda : existingItems,
        attendeeNames: attendees !== undefined ? attendees : existingAttendees,
        chefeAgrupamento: chefeAgrupamento !== undefined ? chefeAgrupamento : existingChefe,
        secretario: secretario !== undefined ? secretario : existingSecretario
      }

      await prisma.meeting.update({
        where: { id },
        data: {
          agenda: agendaData
        }
      })
    }

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('Error updating meeting:', error)
    return NextResponse.json(
      { error: 'Failed to update meeting' },
      { status: 500 }
    )
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

    const { id } = await params
    
    // Check if meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // For now, allow any authenticated user to delete
    // In production, you might want to add role-based permissions

    await prisma.meeting.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Meeting deleted successfully' })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return NextResponse.json(
      { error: 'Failed to delete meeting' },
      { status: 500 }
    )
  }
}