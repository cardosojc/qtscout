import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { mapRow, type ImportRow, type ScoutImportPayload } from '@/lib/siie-import'

export const runtime = 'nodejs'

type ImportSummary = {
  total: number
  created: number
  updated: number
  linkedToProfile: number
  errors: { row: number; nome: string; error: string }[]
}

type ValidRow = { row: number; nin: string; payload: ScoutImportPayload }

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem importar' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Ficheiro não fornecido' }, { status: 400 })
  }

  let rows: ImportRow[]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return NextResponse.json({ error: 'Folha vazia' }, { status: 400 })
    rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { raw: true, defval: null })
  } catch (err) {
    return NextResponse.json(
      { error: `Não foi possível ler o ficheiro: ${(err as Error).message}` },
      { status: 400 }
    )
  }

  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    linkedToProfile: 0,
    errors: [],
  }

  // Phase 1: validate + collect valid rows
  const valid: ValidRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRow(rows[i], i + 2) // +2: header is row 1
    if (!mapped.ok) {
      summary.errors.push({ row: mapped.row, nome: mapped.nome, error: mapped.error })
      continue
    }
    valid.push({ row: i + 2, nin: mapped.nin, payload: mapped.payload })
  }

  if (valid.length === 0) {
    return NextResponse.json({ summary })
  }

  // Phase 2: single round-trip lookups for upsert decisions
  const [existingScouts, profiles] = await Promise.all([
    prisma.scout.findMany({
      where: { numeroAssociado: { in: valid.map((v) => v.nin) } },
      select: { numeroAssociado: true },
    }),
    prisma.profile.findMany({ select: { id: true, email: true } }),
  ])
  const existingNins = new Set(
    existingScouts.map((s) => s.numeroAssociado).filter((n): n is string => n != null)
  )
  const emailToProfileId = new Map<string, string>(
    profiles.map((p) => [p.email.toLowerCase(), p.id])
  )

  // Phase 3: batch upserts in parallel. Profile link is only applied on create,
  // so existing manual links are preserved.
  type UpsertOutcome =
    | { ok: true; row: number; wasExisting: boolean; linkedProfile: boolean }
    | { ok: false; row: number; nome: string; error: string }

  const outcomes = await Promise.all(
    valid.map(async ({ row, nin, payload }): Promise<UpsertOutcome> => {
      const { joinedAt, ...rest } = payload
      const wasExisting = existingNins.has(nin)
      const linkedProfileId = payload.email
        ? emailToProfileId.get(payload.email.toLowerCase()) ?? null
        : null
      const profileConnect =
        !wasExisting && linkedProfileId
          ? { profile: { connect: { id: linkedProfileId } } }
          : {}
      try {
        await prisma.scout.upsert({
          where: { numeroAssociado: nin },
          create: { ...rest, ...(joinedAt ? { joinedAt } : {}), ...profileConnect },
          update: { ...rest, ...(joinedAt ? { joinedAt } : {}) },
        })
        return { ok: true, row, wasExisting, linkedProfile: !wasExisting && linkedProfileId != null }
      } catch (err) {
        const e = err as { code?: string; message?: string }
        return {
          ok: false,
          row,
          nome: `${payload.firstName} ${payload.lastName}`.trim(),
          error:
            e.code === 'P2002'
              ? 'Conflito de unicidade (já existe outro membro)'
              : e.message ?? 'Erro desconhecido',
        }
      }
    })
  )

  for (const o of outcomes) {
    if (o.ok) {
      if (o.wasExisting) summary.updated++
      else summary.created++
      if (o.linkedProfile) summary.linkedToProfile++
    } else {
      summary.errors.push({ row: o.row, nome: o.nome, error: o.error })
    }
  }

  return NextResponse.json({ summary })
}
