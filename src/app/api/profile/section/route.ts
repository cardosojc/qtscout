import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { isOrdemSection } from '@/types/ordem-item'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { section: true },
  })
  return NextResponse.json({ section: profile?.section ?? null })
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { section?: unknown }
  const section = body.section
  if (section !== null && !isOrdemSection(section)) {
    return NextResponse.json({ error: 'Secção inválida' }, { status: 400 })
  }

  await prisma.profile.update({
    where: { id: session.user.id },
    data: { section: section ?? null },
  })

  return NextResponse.json({ section: section ?? null })
}
