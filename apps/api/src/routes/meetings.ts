import { Hono } from 'hono'
import { prisma } from '@qtscout/db'
import { generateMeetingPDF } from '@qtscout/core/pdf-generator'
import { requireAuth } from '../middleware/auth'
import { pdfResponse } from '../lib/pdf-response'
import type { AppEnv } from '../types'

export const meetings = new Hono<AppEnv>()
meetings.use('*', requireAuth)

meetings.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const skip = (page - 1) * limit
    const fromParam = c.req.query('from')
    const toParam = c.req.query('to')

    const dateFilter = (fromParam || toParam) ? {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam) } : {}),
    } : undefined
    const where = dateFilter ? { date: dateFilter } : undefined

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: {
          meetingType: true,
          createdBy: { select: { name: true, email: true } },
          attendees: { include: { profile: { select: { name: true, email: true } } } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.meeting.count({ where }),
    ])

    return c.json({
      meetings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return c.json({ error: 'Failed to fetch meetings' }, 500)
  }
})

meetings.post('/', async (c) => {
  try {
    const session = c.get('session')
    const body = await c.req.json()
    const {
      meetingTypeId, date, startTime, endTime, location, agenda, content,
      actionItems, attendees, chefeAgrupamento, secretario,
    } = body

    const meetingType = await prisma.meetingType.findUnique({ where: { id: meetingTypeId } })
    if (!meetingType) return c.json({ error: 'Invalid meeting type' }, 400)

    const meetingDate = new Date(date)
    const year = meetingDate.getFullYear()
    const month = (meetingDate.getMonth() + 1).toString().padStart(2, '0')
    const day = meetingDate.getDate().toString().padStart(2, '0')
    const identifier = `${meetingType.code}-${year}${month}${day}`

    const meeting = await prisma.meeting.create({
      data: {
        identifier,
        date: new Date(date),
        startTime, endTime, location, agenda, content,
        decisions: undefined,
        actionItems,
        meetingTypeId,
        createdById: session.user.id,
      },
    })

    if ((attendees && attendees.length > 0) || chefeAgrupamento || secretario) {
      const currentAgenda = meeting.agenda as Record<string, unknown> | unknown[]
      const agendaItems = Array.isArray(currentAgenda) ? currentAgenda : []
      const agendaData = {
        items: agendaItems,
        attendeeNames: attendees || [],
        chefeAgrupamento: chefeAgrupamento || '',
        secretario: secretario || '',
      }
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { agenda: JSON.parse(JSON.stringify(agendaData)) },
      })
    }

    return c.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    return c.json({ error: 'Failed to create meeting' }, 500)
  }
})

meetings.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        meetingType: true,
        createdBy: { select: { name: true, email: true } },
        attendees: { include: { profile: { select: { name: true, email: true } } } },
      },
    })
    if (!meeting) return c.json({ error: 'Meeting not found' }, 404)
    return c.json(meeting)
  } catch (error) {
    console.error('Error fetching meeting:', error)
    return c.json({ error: 'Failed to fetch meeting' }, 500)
  }
})

meetings.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const {
      meetingTypeId, date, startTime, endTime, location, agenda, content,
      actionItems, attendees, chefeAgrupamento, secretario,
    } = body

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
      include: { meetingType: true },
    })
    if (!existingMeeting) return c.json({ error: 'Meeting not found' }, 404)

    const updateData: Record<string, unknown> = {
      meetingTypeId: meetingTypeId || undefined,
      date: date ? new Date(date) : undefined,
      startTime, endTime, location, agenda, content, actionItems,
    }

    if (meetingTypeId || date) {
      const finalMeetingTypeId = meetingTypeId || existingMeeting.meetingTypeId
      const finalDate = date ? new Date(date) : new Date(existingMeeting.date)
      const meetingType = await prisma.meetingType.findUnique({ where: { id: finalMeetingTypeId } })
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
        createdBy: { select: { name: true, email: true } },
        attendees: { include: { profile: { select: { name: true, email: true } } } },
      },
    })

    if (attendees !== undefined || chefeAgrupamento !== undefined || secretario !== undefined || agenda !== undefined) {
      const currentAgenda = (updateData.agenda || updatedMeeting.agenda) as Record<string, unknown>
      let existingItems: unknown[] = []
      let existingAttendees: string[] = []
      let existingChefe = ''
      let existingSecretario = ''

      if (Array.isArray(currentAgenda)) {
        existingItems = currentAgenda
      } else if (currentAgenda && typeof currentAgenda === 'object') {
        existingItems = (currentAgenda.items as unknown[]) || []
        existingAttendees = (currentAgenda.attendeeNames as string[]) || []
        existingChefe = (currentAgenda.chefeAgrupamento as string) || ''
        existingSecretario = (currentAgenda.secretario as string) || ''
      }

      const agendaData = {
        items: agenda !== undefined ? agenda : existingItems,
        attendeeNames: attendees !== undefined ? attendees : existingAttendees,
        chefeAgrupamento: chefeAgrupamento !== undefined ? chefeAgrupamento : existingChefe,
        secretario: secretario !== undefined ? secretario : existingSecretario,
      }

      await prisma.meeting.update({
        where: { id },
        data: { agenda: JSON.parse(JSON.stringify(agendaData)) },
      })
    }

    return c.json(updatedMeeting)
  } catch (error) {
    console.error('Error updating meeting:', error)
    return c.json({ error: 'Failed to update meeting' }, 500)
  }
})

meetings.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const meeting = await prisma.meeting.findUnique({ where: { id } })
    if (!meeting) return c.json({ error: 'Meeting not found' }, 404)
    await prisma.meeting.delete({ where: { id } })
    return c.json({ message: 'Meeting deleted successfully' })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return c.json({ error: 'Failed to delete meeting' }, 500)
  }
})

meetings.get('/:id/pdf', async (c) => {
  try {
    const id = c.req.param('id')
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        meetingType: true,
        createdBy: { select: { name: true, email: true } },
      },
    })
    if (!meeting) return c.json({ error: 'Meeting not found' }, 404)

    const meetingForPDF = {
      ...meeting,
      date: meeting.date.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt?.toISOString(),
      agenda: (meeting.agenda as Record<string, unknown>) || {},
      actionItems: (meeting.actionItems as Record<string, unknown>[]) || [],
    }
    const pdfBuffer = await generateMeetingPDF(meetingForPDF)

    const disposition = c.req.query('download') === 'true' ? 'attachment' : 'inline'
    return pdfResponse(c, pdfBuffer, `${meeting.identifier}.pdf`, disposition)
  } catch (error) {
    console.error('Error generating PDF:', error)
    return c.json({ error: 'Failed to generate PDF' }, 500)
  }
})
