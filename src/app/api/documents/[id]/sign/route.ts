import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.id },
    select: { signature: true },
  })
  if (!profile?.signature) {
    return NextResponse.json(
      { error: 'Carregue uma assinatura no seu perfil antes de assinar.' },
      { status: 400 }
    )
  }

  const document = await prisma.document.findUnique({ where: { id }, select: { id: true, signedById: true } })
  if (!document) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  if (document.signedById) {
    return NextResponse.json({ error: 'Documento já assinado' }, { status: 409 })
  }

  await prisma.document.update({
    where: { id },
    data: { signedById: session.user.id, signedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id }, select: { signedById: true } })
  if (!document) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  if (!document.signedById) return NextResponse.json({ ok: true })

  if (document.signedById !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas o signatário ou um administrador podem remover a assinatura.' }, { status: 403 })
  }

  await prisma.document.update({
    where: { id },
    data: { signedById: null, signedAt: null },
  })

  return NextResponse.json({ ok: true })
}
