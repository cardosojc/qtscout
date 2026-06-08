import { Hono } from 'hono'
import * as XLSX from 'xlsx'
import { prisma, type Prisma } from '@qtscout/db'
import { isOrdemSection } from '@qtscout/types/ordem-item'
import { isNightsBadgeCount, NIGHTS_BADGE_COUNTS } from '@qtscout/types/scout'
import { mapRow, type ImportRow, type ScoutImportPayload } from '@qtscout/core/siie-import'
import { requireAuth, requireAdmin } from '../middleware/auth'
import type { AppEnv } from '../types'

const OPTIONAL_STRING_FIELDS = [
  'numeroAssociado', 'sexo', 'cc', 'nif', 'email', 'telefone', 'telemovel',
  'morada', 'localidade', 'codigoPostal', 'paiNome', 'paiTelefone', 'paiEmail',
  'maeNome', 'maeTelefone', 'maeEmail', 'encarregadoNome', 'encarregadoTelefone',
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

export const scouts = new Hono<AppEnv>()
scouts.use('*', requireAuth)

scouts.get('/', async (c) => {
  const section = c.req.query('section')
  const includeInactive = c.req.query('includeInactive') === 'true'

  const where: Prisma.ScoutWhereInput = {}
  if (section && isOrdemSection(section)) where.section = section
  if (!includeInactive) where.active = true

  const scouts = await prisma.scout.findMany({
    where,
    orderBy: [{ section: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  })
  return c.json({ scouts })
})

scouts.post('/', requireAdmin, async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
  if (!firstName || !lastName) {
    return c.json({ error: 'Nome e apelido obrigatórios' }, 400)
  }

  const dateOfBirth = parseDate(body.dateOfBirth)
  if (!dateOfBirth) {
    return c.json({ error: 'Data de nascimento inválida' }, 400)
  }

  let section: Prisma.ScoutCreateInput['section'] = null
  if (body.section != null && body.section !== '') {
    if (!isOrdemSection(body.section)) {
      return c.json({ error: 'Secção inválida' }, 400)
    }
    section = body.section
  }

  const joinedAt = parseDate(body.joinedAt) ?? new Date()
  const noitesCampoInicial = Number.isFinite(Number(body.noitesCampoInicial))
    ? Math.max(0, Math.floor(Number(body.noitesCampoInicial)))
    : 0

  const data: Prisma.ScoutCreateInput = {
    firstName, lastName, dateOfBirth, section, joinedAt, noitesCampoInicial,
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    data[field] = optionalString(body[field])
  }

  try {
    const scout = await prisma.scout.create({ data })
    return c.json({ scout })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') return c.json({ error: 'Nº de associado já existe' }, 409)
    throw err
  }
})

// SIIE import (multipart). Registered before /:id so the static path wins.
scouts.post('/import', requireAdmin, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'Ficheiro não fornecido' }, 400)
  }

  let rows: ImportRow[]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return c.json({ error: 'Folha vazia' }, 400)
    rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { raw: true, defval: null })
  } catch (err) {
    return c.json({ error: `Não foi possível ler o ficheiro: ${(err as Error).message}` }, 400)
  }

  type ImportSummary = {
    total: number; created: number; updated: number; linkedToProfile: number
    errors: { row: number; nome: string; error: string }[]
  }
  type ValidRow = { row: number; nin: string; payload: ScoutImportPayload }

  const summary: ImportSummary = {
    total: rows.length, created: 0, updated: 0, linkedToProfile: 0, errors: [],
  }

  const valid: ValidRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRow(rows[i], i + 2)
    if (!mapped.ok) {
      summary.errors.push({ row: mapped.row, nome: mapped.nome, error: mapped.error })
      continue
    }
    valid.push({ row: i + 2, nin: mapped.nin, payload: mapped.payload })
  }

  if (valid.length === 0) return c.json({ summary })

  const [existingScouts, profiles] = await Promise.all([
    prisma.scout.findMany({
      where: { numeroAssociado: { in: valid.map((v) => v.nin) } },
      select: { numeroAssociado: true },
    }),
    prisma.profile.findMany({ select: { id: true, email: true } }),
  ])
  const existingNins = new Set(
    existingScouts.map((s) => s.numeroAssociado).filter((n): n is string => n != null),
  )
  const emailToProfileId = new Map<string, string>(
    profiles.map((p) => [p.email.toLowerCase(), p.id]),
  )

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
          ok: false, row,
          nome: `${payload.firstName} ${payload.lastName}`.trim(),
          error: e.code === 'P2002'
            ? 'Conflito de unicidade (já existe outro membro)'
            : e.message ?? 'Erro desconhecido',
        }
      }
    }),
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

  return c.json({ summary })
})

scouts.get('/:id', async (c) => {
  const id = c.req.param('id')
  const scout = await prisma.scout.findUnique({ where: { id } })
  if (!scout) return c.json({ error: 'Membro não encontrado' }, 404)
  return c.json({ scout })
})

scouts.patch('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as Record<string, unknown>

  const update: Prisma.ScoutUpdateInput = {}
  if (typeof body.firstName === 'string') {
    if (!body.firstName.trim()) return c.json({ error: 'Nome obrigatório' }, 400)
    update.firstName = body.firstName.trim()
  }
  if (typeof body.lastName === 'string') {
    if (!body.lastName.trim()) return c.json({ error: 'Apelido obrigatório' }, 400)
    update.lastName = body.lastName.trim()
  }
  if (body.dateOfBirth !== undefined) {
    const d = parseDate(body.dateOfBirth)
    if (!d) return c.json({ error: 'Data de nascimento inválida' }, 400)
    update.dateOfBirth = d
  }
  if (body.section !== undefined) {
    if (body.section === null || body.section === '') {
      update.section = null
    } else {
      if (!isOrdemSection(body.section)) return c.json({ error: 'Secção inválida' }, 400)
      update.section = body.section
    }
  }
  if (body.joinedAt !== undefined) {
    const d = parseDate(body.joinedAt)
    if (!d) return c.json({ error: 'Data de admissão inválida' }, 400)
    update.joinedAt = d
  }
  if (body.active !== undefined) {
    update.active = Boolean(body.active)
  }
  if (body.noitesCampoInicial !== undefined) {
    const n = Number(body.noitesCampoInicial)
    if (!Number.isFinite(n) || n < 0) return c.json({ error: 'Noites de campo inválido' }, 400)
    update.noitesCampoInicial = Math.floor(n)
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (body[field] !== undefined) update[field] = optionalString(body[field])
  }

  try {
    const scout = await prisma.scout.update({ where: { id }, data: update })
    return c.json({ scout })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') return c.json({ error: 'Nº de associado já existe' }, 409)
    if (e.code === 'P2025') return c.json({ error: 'Membro não encontrado' }, 404)
    throw err
  }
})

scouts.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  try {
    await prisma.scout.delete({ where: { id } })
    return c.json({ ok: true })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2025') return c.json({ error: 'Membro não encontrado' }, 404)
    throw err
  }
})

scouts.get('/:id/nights-badges', async (c) => {
  const id = c.req.param('id')
  const badges = await prisma.scoutNightsBadge.findMany({
    where: { scoutId: id },
    select: { count: true, awardedAt: true },
    orderBy: { count: 'asc' },
  })
  return c.json({ badges })
})

scouts.put('/:id/nights-badges', requireAdmin, async (c) => {
  const id = c.req.param('id')

  const scout = await prisma.scout.findUnique({ where: { id }, select: { id: true } })
  if (!scout) return c.json({ error: 'Membro não encontrado' }, 404)

  const body = (await c.req.json()) as { badges?: unknown }
  if (!Array.isArray(body.badges)) {
    return c.json({ error: 'Formato inválido' }, 400)
  }

  const toDelete: number[] = []
  const toUpsert: { count: number; awardedAt: Date }[] = []

  for (const raw of body.badges) {
    if (raw === null || typeof raw !== 'object') continue
    const entry = raw as { count?: unknown; awardedAt?: unknown }
    if (!isNightsBadgeCount(entry.count)) {
      return c.json({ error: `count inválido (${entry.count})` }, 400)
    }
    if (entry.awardedAt == null || entry.awardedAt === '') {
      toDelete.push(entry.count)
      continue
    }
    const date = parseDate(entry.awardedAt)
    if (!date) return c.json({ error: `Data inválida para ${entry.count}` }, 400)
    toUpsert.push({ count: entry.count, awardedAt: date })
  }

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [prisma.scoutNightsBadge.deleteMany({ where: { scoutId: id, count: { in: toDelete } } })]
      : []),
    ...toUpsert.map((b) =>
      prisma.scoutNightsBadge.upsert({
        where: { scoutId_count: { scoutId: id, count: b.count } },
        create: { scoutId: id, count: b.count, awardedAt: b.awardedAt },
        update: { awardedAt: b.awardedAt },
      }),
    ),
  ])

  const badges = await prisma.scoutNightsBadge.findMany({
    where: { scoutId: id },
    select: { count: true, awardedAt: true },
    orderBy: { count: 'asc' },
  })
  return c.json({ badges, allCounts: NIGHTS_BADGE_COUNTS })
})
