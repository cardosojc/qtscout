import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
    const sortBy = searchParams.get('sortBy') || 'relevance'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build the where clause for non-text queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    if (meetingTypeId) {
      where.meetingTypeId = meetingTypeId
    }

    if (dateFrom || dateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.date = dateFilter
    }

    // For non-text queries: 'relevance' falls back to date desc
    const orderBy = sortBy === 'identifier'
      ? { identifier: sortOrder as 'asc' | 'desc' }
      : { date: 'desc' as const }

    let meetings
    if (query) {
      // Escape special characters and build tsquery with prefix matching
      const tsQuery = query
        .split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => `${term.replace(/['":*\\]/g, '')}:*`)
        .join(' & ')

      if (tsQuery) {
        const whereConditions: Prisma.Sql[] = [
          Prisma.sql`m."contentTsvector" @@ to_tsquery('portuguese', ${tsQuery})`
        ]

        if (meetingTypeId) {
          whereConditions.push(Prisma.sql`m."meetingTypeId" = ${meetingTypeId}`)
        }
        if (dateFrom) {
          whereConditions.push(Prisma.sql`m.date >= ${new Date(dateFrom)}`)
        }
        if (dateTo) {
          whereConditions.push(Prisma.sql`m.date <= ${new Date(dateTo)}`)
        }

        const orderClause = sortBy === 'identifier'
          ? sortOrder === 'asc'
            ? Prisma.sql`ORDER BY m.identifier ASC`
            : Prisma.sql`ORDER BY m.identifier DESC`
          : sortBy === 'date'
            ? sortOrder === 'asc'
              ? Prisma.sql`ORDER BY m.date ASC`
              : Prisma.sql`ORDER BY m.date DESC`
            : Prisma.sql`ORDER BY rank DESC`

        const whereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`

        const rawQuery = Prisma.sql`
          SELECT
            m.id,
            m.identifier,
            m.date,
            m."startTime",
            m."endTime",
            m.location,
            m.agenda,
            m.content,
            m.decisions,
            m."actionItems",
            m."createdAt",
            m."updatedAt",
            m."meetingTypeId",
            m."createdById",
            mt.id AS "meetingType_id",
            mt.code AS "meetingType_code",
            mt.name AS "meetingType_name",
            mt.description AS "meetingType_description",
            mt."createdAt" AS "meetingType_createdAt",
            mt."updatedAt" AS "meetingType_updatedAt",
            p.id AS "createdBy_id",
            p.name AS "createdBy_name",
            p.email AS "createdBy_email",
            ts_rank_cd(m."contentTsvector", to_tsquery('portuguese', ${tsQuery})) AS rank,
            ts_headline(
              'portuguese',
              regexp_replace(m.content, '<[^>]+>', ' ', 'g'),
              to_tsquery('portuguese', ${tsQuery}),
              'MaxWords=50,MinWords=20,MaxFragments=2,StartSel=<mark>,StopSel=</mark>'
            ) AS snippet
          FROM meetings m
          JOIN meeting_types mt ON m."meetingTypeId" = mt.id
          JOIN profiles p ON m."createdById" = p.id
          ${whereClause}
          ${orderClause}
          LIMIT 50
        `

        const result = await prisma.$queryRaw<Array<{
          id: string
          identifier: string
          date: Date
          startTime: string | null
          endTime: string | null
          location: string | null
          agenda: unknown
          content: string
          decisions: unknown | null
          actionItems: unknown | null
          createdAt: Date
          updatedAt: Date
          meetingTypeId: string
          createdById: string
          meetingType_id: string
          meetingType_code: string
          meetingType_name: string
          meetingType_description: string | null
          meetingType_createdAt: Date
          meetingType_updatedAt: Date
          createdBy_id: string
          createdBy_name: string
          createdBy_email: string
          rank: number
          snippet: string
        }>>(rawQuery)

        meetings = result.map(row => ({
          id: row.id,
          identifier: row.identifier,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          location: row.location,
          agenda: row.agenda,
          content: row.content,
          decisions: row.decisions,
          actionItems: row.actionItems,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          meetingTypeId: row.meetingTypeId,
          createdById: row.createdById,
          meetingType: {
            id: row.meetingType_id,
            code: row.meetingType_code,
            name: row.meetingType_name,
            description: row.meetingType_description,
            createdAt: row.meetingType_createdAt,
            updatedAt: row.meetingType_updatedAt
          },
          createdBy: {
            name: row.createdBy_name,
            email: row.createdBy_email
          },
          rank: row.rank,
          snippet: row.snippet
        }))
      } else {
        // Fallback if tsQuery is empty after sanitisation
        meetings = await prisma.meeting.findMany({
          where,
          include: {
            meetingType: true,
            createdBy: { select: { name: true, email: true } }
          },
          orderBy,
          take: 50
        })
      }
    } else {
      // No text query — use standard Prisma query
      meetings = await prisma.meeting.findMany({
        where,
        include: {
          meetingType: true,
          createdBy: { select: { name: true, email: true } }
        },
        orderBy,
        take: 50
      })
    }

    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Error searching meetings:', error)
    return NextResponse.json(
      { error: 'Failed to search meetings' },
      { status: 500 }
    )
  }
}
