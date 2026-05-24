import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profiles = await prisma.profile.findMany({
    where: { role: { in: ['ADMIN', 'LEADER'] } },
    select: { id: true, name: true, email: true, section: true, roles: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ profiles })
}
