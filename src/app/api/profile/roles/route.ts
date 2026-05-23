import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { isLeaderRole } from '@/types/leader-role'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  })
  return NextResponse.json({ roles: profile?.roles ?? [] })
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roles } = (await request.json()) as { roles?: unknown }
  if (!Array.isArray(roles) || !roles.every(isLeaderRole)) {
    return NextResponse.json({ error: 'Funções inválidas' }, { status: 400 })
  }

  const unique = Array.from(new Set(roles))
  await prisma.profile.update({
    where: { id: session.user.id },
    data: { roles: unique },
  })

  return NextResponse.json({ roles: unique })
}
