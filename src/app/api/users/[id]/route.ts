import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não pode alterar o seu próprio papel' }, { status: 400 })
  }

  const { role } = await request.json()
  if (!['ADMIN', 'LEADER', 'MEMBER'].includes(role)) {
    return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
  }

  const user = await prisma.profile.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, username: true, role: true, createdAt: true },
  })

  return NextResponse.json({ user })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não pode eliminar a sua própria conta' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Delete from Supabase Auth first (cascades nothing in DB — profile deleted separately)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  await prisma.profile.delete({ where: { id } })

  return NextResponse.json({ message: 'Utilizador eliminado' })
}
