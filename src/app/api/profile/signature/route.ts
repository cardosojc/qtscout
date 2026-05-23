import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const MAX_SIGNATURE_BYTES = 500_000 // ~500KB of base64 payload
const ALLOWED_MIME = /^data:image\/(png|jpe?g);base64,/i

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { signature: true },
  })
  return NextResponse.json({ signature: profile?.signature ?? null })
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signature } = (await request.json()) as { signature?: string }
  if (typeof signature !== 'string' || !ALLOWED_MIME.test(signature)) {
    return NextResponse.json({ error: 'Imagem inválida (PNG ou JPEG)' }, { status: 400 })
  }
  if (signature.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: 'Imagem demasiado grande (máx. ~400KB)' }, { status: 413 })
  }

  await prisma.profile.update({
    where: { id: session.user.id },
    data: { signature },
  })

  return NextResponse.json({ signature })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.profile.update({
    where: { id: session.user.id },
    data: { signature: null },
  })

  return NextResponse.json({ signature: null })
}
