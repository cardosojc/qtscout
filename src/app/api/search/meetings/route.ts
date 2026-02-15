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
    const query = searchParams.get('q') || ''
    const meetingTypeId = searchParams.get('type')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build the where clause
    const where: Record<string, unknown> = {}

    // Text search across content, agenda, and action items
    if (query) {
      where.OR = [
        {
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          identifier: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          location: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Filter by meeting type
    if (meetingTypeId) {
      where.meetingTypeId = meetingTypeId
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom)
      }
      if (dateTo) {
        dateFilter.lte = new Date(dateTo)
      }
      where.date = dateFilter
    }

    // Build order clause
    const orderBy: Record<string, unknown> = {}
    if (sortBy === 'date') {
      orderBy.date = sortOrder
    } else if (sortBy === 'identifier') {
      orderBy.identifier = sortOrder
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        meetingType: true,
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy,
      take: 50 // Limit results for performance
    })

    // If we have a text query, we can do additional filtering on JSON fields
    let filteredMeetings = meetings
    if (query) {
      filteredMeetings = meetings.filter(meeting => {
        const searchText = query.toLowerCase()
        
        // Search in content (already handled by Prisma)
        if (meeting.content?.toLowerCase().includes(searchText)) {
          return true
        }
        
        // Search in agenda items
        if (meeting.agenda) {
          const agendaItems = Array.isArray(meeting.agenda) ? meeting.agenda : []
          for (const item of agendaItems) {
            if (item && typeof item === 'object' && 
                ((item as { title?: string }).title?.toLowerCase().includes(searchText) || 
                 (item as { description?: string }).description?.toLowerCase().includes(searchText))) {
              return true
            }
          }
          
          // Search in attendee names
          const agendaObj = meeting.agenda as { attendeeNames?: string[] }
          const attendeeNames = agendaObj?.attendeeNames || []
          for (const name of attendeeNames) {
            if (typeof name === 'string' && name.toLowerCase().includes(searchText)) {
              return true
            }
          }
        }
        
        // Search in action items
        if (meeting.actionItems) {
          const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems : []
          for (const item of actionItems) {
            if (item && typeof item === 'object' &&
                ((item as { description?: string }).description?.toLowerCase().includes(searchText) || 
                 (item as { responsible?: string }).responsible?.toLowerCase().includes(searchText))) {
              return true
            }
          }
        }
        
        return false
      })
    }

    return NextResponse.json(filteredMeetings)
  } catch (error) {
    console.error('Error searching meetings:', error)
    return NextResponse.json(
      { error: 'Failed to search meetings' },
      { status: 500 }
    )
  }
}