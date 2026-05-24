import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { isOrdemSection } from '@/types/ordem-item'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const scout = await prisma.scout.findUnique({ where: { id } })
  if (!scout) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  return NextResponse.json({ scout })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem editar membros' }, { status: 403 })
  }

  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>

  const update: Prisma.ScoutUpdateInput = {}
  if (typeof body.firstName === 'string') {
    if (!body.firstName.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    update.firstName = body.firstName.trim()
  }
  if (typeof body.lastName === 'string') {
    if (!body.lastName.trim()) return NextResponse.json({ error: 'Apelido obrigatório' }, { status: 400 })
    update.lastName = body.lastName.trim()
  }
  if (body.dateOfBirth !== undefined) {
    const d = parseDate(body.dateOfBirth)
    if (!d) return NextResponse.json({ error: 'Data de nascimento inválida' }, { status: 400 })
    update.dateOfBirth = d
  }
  if (body.section !== undefined) {
    if (body.section === null || body.section === '') {
      update.section = null
    } else {
      if (!isOrdemSection(body.section)) {
        return NextResponse.json({ error: 'Secção inválida' }, { status: 400 })
      }
      update.section = body.section
    }
  }
  if (body.joinedAt !== undefined) {
    const d = parseDate(body.joinedAt)
    if (!d) return NextResponse.json({ error: 'Data de admissão inválida' }, { status: 400 })
    update.joinedAt = d
  }
  if (body.active !== undefined) {
    update.active = Boolean(body.active)
  }
  if (body.noitesCampoInicial !== undefined) {
    const n = Number(body.noitesCampoInicial)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'Noites de campo inválido' }, { status: 400 })
    }
    update.noitesCampoInicial = Math.floor(n)
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined) {
      update[field] = optionalString(body[field])
    }
  }

  try {
    const scout = await prisma.scout.update({ where: { id }, data: update })
    return NextResponse.json({ scout })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Nº de associado já existe' }, { status: 409 })
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem eliminar membros' }, { status: 403 })
  }

  const { id } = await params
  try {
    await prisma.scout.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }
    throw err
  }
}
