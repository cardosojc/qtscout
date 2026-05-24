import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { mapActivityRow, type ActivityPayload, type ActivityRow } from '@/lib/siie-atividades-import'

export const runtime = 'nodejs'

type ImportSummary = {
  total: number
  created: number
  updated: number
  skipped: number
  errors: { row: number; descricao: string; error: string }[]
}

type ValidRow = { row: number; payload: ActivityPayload }

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

  let rows: ActivityRow[]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return NextResponse.json({ error: 'Folha vazia' }, { status: 400 })
    rows = XLSX.utils.sheet_to_json<ActivityRow>(sheet, { raw: true, defval: null })
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
    skipped: 0,
    errors: [],
  }

  // Phase 1: validate + collect valid rows
  const valid: ValidRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const mapped = mapActivityRow(rows[i], i + 2)
    if (!mapped.ok) {
      summary.errors.push({ row: mapped.row, descricao: mapped.descricao, error: mapped.error })
      continue
    }
    valid.push({ row: i + 2, payload: mapped.payload })
  }

  if (valid.length === 0) {
    return NextResponse.json({ summary })
  }

  // Phase 2: single round-trip lookup to identify existing + locked rows
  const existing = await prisma.ordemItem.findMany({
    where: { externalId: { in: valid.map((v) => v.payload.externalId) } },
    select: { externalId: true, includedInOsId: true },
  })
  const existingMap = new Map(
    existing.map((e) => [e.externalId as string, e.includedInOsId])
  )

  // Phase 3: batch upserts in parallel. Items already snapshotted into an OS
  // are skipped (we don't mutate frozen OS source items).
  type UpsertOutcome =
    | { ok: true; row: number; wasExisting: boolean; skipped: boolean }
    | { ok: false; row: number; descricao: string; error: string }

  const outcomes = await Promise.all(
    valid.map(async ({ row, payload }): Promise<UpsertOutcome> => {
      const includedInOsId = existingMap.get(payload.externalId)
      const wasExisting = existingMap.has(payload.externalId)
      if (wasExisting && includedInOsId) {
        return { ok: true, row, wasExisting: true, skipped: true }
      }
      const data: Prisma.InputJsonValue = {
        nome: payload.nome,
        datas: payload.datas,
        local: payload.local,
      }
      try {
        await prisma.ordemItem.upsert({
          where: { externalId: payload.externalId },
          create: {
            externalId: payload.externalId,
            category: 'ATIVIDADE',
            section: payload.section,
            date: payload.date,
            data,
            createdById: session.user.id,
          },
          update: {
            category: 'ATIVIDADE',
            section: payload.section,
            date: payload.date,
            data,
          },
        })
        return { ok: true, row, wasExisting, skipped: false }
      } catch (err) {
        const e = err as { code?: string; message?: string }
        return {
          ok: false,
          row,
          descricao: payload.nome,
          error: e.code === 'P2002' ? 'Conflito de unicidade' : e.message ?? 'Erro desconhecido',
        }
      }
    })
  )

  for (const o of outcomes) {
    if (!o.ok) {
      summary.errors.push({ row: o.row, descricao: o.descricao, error: o.error })
      continue
    }
    if (o.skipped) summary.skipped++
    else if (o.wasExisting) summary.updated++
    else summary.created++
  }

  return NextResponse.json({ summary })
}
