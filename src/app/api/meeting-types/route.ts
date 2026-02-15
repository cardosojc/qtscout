import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const meetingTypes = await prisma.meetingType.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(meetingTypes)
  } catch (error) {
    console.error('Error fetching meeting types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting types' },
      { status: 500 }
    )
  }
}