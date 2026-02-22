import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import type { DocumentType } from '@/types/document'

const ALL_TYPES: DocumentType[] = ['OFICIO', 'CIRCULAR', 'ORDEM_SERVICO']

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await prisma.documentSettings.findMany()
    const settingsMap = Object.fromEntries(rows.map((r) => [r.type, r.startingNumber]))

    const settings = ALL_TYPES.map((type) => ({
      type,
      startingNumber: settingsMap[type] ?? 1,
    }))

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching document settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body as { settings: { type: DocumentType; startingNumber: number }[] }

    await Promise.all(
      settings.map((s) =>
        prisma.documentSettings.upsert({
          where: { type: s.type },
          create: { type: s.type, startingNumber: s.startingNumber },
          update: { startingNumber: s.startingNumber },
        })
      )
    )

    return NextResponse.json({ message: 'Settings saved' })
  } catch (error) {
    console.error('Error saving document settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
