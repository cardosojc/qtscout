import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { mapRow, type ImportRow, type MappedRow } from '@/lib/siie-import'

export const runtime = 'nodejs'

type ImportSummary = {
  total: number
  created: number
  updated: number
  linkedToProfile: number
  errors: { row: number; nome: string; error: string }[]
}

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

  // Pre-load profiles for email-based linking (leaders only)
  const profileEmails = await prisma.profile.findMany({
    select: { id: true, email: true },
  })
  const emailToProfileId = new Map<string, string>(
    profileEmails.map((p) => [p.email.toLowerCase(), p.id])
  )

  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    linkedToProfile: 0,
    errors: [],
  }

  // Sequentially process to keep summary deterministic; volume is small (~100s).
  for (let i = 0; i < rows.length; i++) {
    const mapped: MappedRow = mapRow(rows[i], i + 2) // +2: header is row 1, data starts at 2
    if (!mapped.ok) {
      summary.errors.push({ row: mapped.row, nome: mapped.nome, error: mapped.error })
      continue
    }

    const { payload, nin } = mapped

    // Find existing scout by numeroAssociado
    const existing = await prisma.scout.findUnique({
      where: { numeroAssociado: nin },
      select: { id: true, profileId: true },
    })

    // Email-based profile link (only set if not already linked)
    let profileIdToLink: string | null = null
    if (payload.email) {
      const match = emailToProfileId.get(payload.email.toLowerCase())
      if (match && (!existing || !existing.profileId)) {
        profileIdToLink = match
      }
    }

    try {
      const { joinedAt, ...rest } = payload
      if (existing) {
        await prisma.scout.update({
          where: { id: existing.id },
          data: {
            ...rest,
            ...(joinedAt ? { joinedAt } : {}),
            ...(profileIdToLink ? { profile: { connect: { id: profileIdToLink } } } : {}),
          },
        })
        summary.updated++
        if (profileIdToLink) summary.linkedToProfile++
      } else {
        await prisma.scout.create({
          data: {
            ...rest,
            ...(joinedAt ? { joinedAt } : {}),
            ...(profileIdToLink ? { profile: { connect: { id: profileIdToLink } } } : {}),
          },
        })
        summary.created++
        if (profileIdToLink) summary.linkedToProfile++
      }
    } catch (err) {
      const e = err as { code?: string; message?: string }
      summary.errors.push({
        row: i + 2,
        nome: `${payload.firstName} ${payload.lastName}`.trim(),
        error: e.code === 'P2002' ? 'Conflito de unicidade (já existe outro membro)' : (e.message ?? 'Erro desconhecido'),
      })
    }
  }

  return NextResponse.json({ summary })
}
