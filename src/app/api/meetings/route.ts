import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
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
        },
        orderBy: {
          date: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.meeting.count()
    ])

    return NextResponse.json({
      meetings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Get meeting type to generate identifier
    const meetingType = await prisma.meetingType.findUnique({
      where: { id: meetingTypeId }
    })

    if (!meetingType) {
      return NextResponse.json({ error: 'Invalid meeting type' }, { status: 400 })
    }

    // Generate meeting identifier (TYPE-YYYYMMDD)
    const meetingDate = new Date(date)
    const year = meetingDate.getFullYear()
    const month = (meetingDate.getMonth() + 1).toString().padStart(2, '0')
    const day = meetingDate.getDate().toString().padStart(2, '0')
    const identifier = `${meetingType.code}-${year}${month}${day}`

    // Create the meeting
    const meeting = await prisma.meeting.create({
      data: {
        identifier,
        date: new Date(date),
        startTime,
        endTime,
        location,
        agenda,
        content,
        decisions: undefined,
        actionItems,
        meetingTypeId,
        createdById: session.user.id
      }
    })

    // Add attendees and special roles (for now we'll create simple string entries)
    // In a full implementation, you'd want to match against existing users
    if (attendees && attendees.length > 0 || chefeAgrupamento || secretario) {
      // For this MVP, we'll store attendees as metadata in the meeting
      // Preserve existing agenda items if they exist
      const currentAgenda = meeting.agenda as Record<string, unknown> | unknown[]
      const agendaItems = Array.isArray(currentAgenda) ? currentAgenda : []

      const agendaData = {
        items: agendaItems,
        attendeeNames: attendees || [],
        chefeAgrupamento: chefeAgrupamento || '',
        secretario: secretario || ''
      }

      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          agenda: JSON.parse(JSON.stringify(agendaData))
        }
      })
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    )
  }
}