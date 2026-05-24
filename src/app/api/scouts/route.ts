import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { isOrdemSection } from '@/types/ordem-item'

const OPTIONAL_STRING_FIELDS = [
  'numeroAssociado',
  'sexo',
  'cc',
  'nif',
  'email',
  'telefone',
  'telemovel',
  'morada',
  'localidade',
  'codigoPostal',
  'paiNome',
  'paiTelefone',
  'paiEmail',
  'maeNome',
  'maeTelefone',
  'maeEmail',
  'encarregadoNome',
  'encarregadoTelefone',
  'encarregadoEmail',
] as const

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section')
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: Prisma.ScoutWhereInput = {}
  if (section && isOrdemSection(section)) where.section = section
  if (!includeInactive) where.active = true

  const scouts = await prisma.scout.findMany({
    where,
    orderBy: [{ section: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  })
  return NextResponse.json({ scouts })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem criar membros' }, { status: 403 })
  }

  const body = (await request.json()) as Record<string, unknown>
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Nome e apelido obrigatórios' }, { status: 400 })
  }

  const dateOfBirth = parseDate(body.dateOfBirth)
  if (!dateOfBirth) {
    return NextResponse.json({ error: 'Data de nascimento inválida' }, { status: 400 })
  }

  let section: Prisma.ScoutCreateInput['section'] = null
  if (body.section != null && body.section !== '') {
    if (!isOrdemSection(body.section)) {
      return NextResponse.json({ error: 'Secção inválida' }, { status: 400 })
    }
    section = body.section
  }

  const joinedAt = parseDate(body.joinedAt) ?? new Date()

  const data: Prisma.ScoutCreateInput = {
    firstName,
    lastName,
    dateOfBirth,
    section,
    joinedAt,
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    data[field] = optionalString(body[field])
  }

  try {
    const scout = await prisma.scout.create({ data })
    return NextResponse.json({ scout })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Nº de associado já existe' }, { status: 409 })
    }
    throw err
  }
}
