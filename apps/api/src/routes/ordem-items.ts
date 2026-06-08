import { Hono } from 'hono'
import * as XLSX from 'xlsx'
import { prisma, type Prisma } from '@qtscout/db'
import { canManageItem, resolveCategory, type ProfileForAuth } from '@qtscout/core/ordem-permissions'
import { annotateItems, resolveRefs } from '@qtscout/core/ordem-resolver'
import { mapActivityRow, type ActivityPayload, type ActivityRow } from '@qtscout/core/siie-atividades-import'
import { isOrdemSection, validateItemData, type ItemShape, type OrdemSection } from '@qtscout/types/ordem-item'
import { requireAuth, requireAdmin } from '../middleware/auth'
import type { AppEnv } from '../types'

async function validateRefs(
  shape: ItemShape,
  value: Record<string, unknown>,
  section: OrdemSection | null,
): Promise<string | null> {
  const scoutIds: string[] = []
  const profileIds: string[] = []

  if (shape === 'MEMBER_REF' && typeof value.scoutId === 'string') {
    scoutIds.push(value.scoutId)
  }
  if (shape === 'NOITES_REF' && Array.isArray(value.scoutIds)) {
    for (const id of value.scoutIds) if (typeof id === 'string') scoutIds.push(id)
  }
  if (shape === 'PROFILE_REF' && typeof value.profileId === 'string') {
    profileIds.push(value.profileId)
  }
  if (shape === 'SCOUT_OR_PROFILE_REF' && typeof value.refId === 'string') {
    if (value.kind === 'scout') scoutIds.push(value.refId)
    if (value.kind === 'profile') profileIds.push(value.refId)
  }

  if (scoutIds.length > 0) {
    const found = await prisma.scout.findMany({
      where: { id: { in: scoutIds } },
      select: { id: true, section: true },
    })
    if (found.length !== scoutIds.length) return 'Membro não encontrado'
    if (section) {
      const mismatched = found.find((s) => s.section !== section)
      if (mismatched) return 'O membro selecionado pertence a outra secção'
    }
  }
  if (profileIds.length > 0) {
    const count = await prisma.profile.count({ where: { id: { in: profileIds } } })
    if (count !== profileIds.length) return 'Dirigente não encontrado'
  }

  return null
}

async function loadAuth(userId: string): Promise<ProfileForAuth | null> {
  const p = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true, roles: true, section: true },
  })
  return p ? { role: p.role, roles: p.roles, section: p.section } : null
}

export const ordemItems = new Hono<AppEnv>()
ordemItems.use('*', requireAuth)

ordemItems.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  const section = c.req.query('section')
  const category = c.req.query('category')
  const included = c.req.query('included') // 'true' | 'false' | undefined

  const where: Prisma.OrdemItemWhereInput = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }
  if (section && isOrdemSection(section)) where.section = section
  if (category) where.category = category
  if (included === 'true') where.includedInOsId = { not: null }
  if (included === 'false') where.includedInOsId = null

  const items = await prisma.ordemItem.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })

  const refs = await resolveRefs(items)
  const annotated = annotateItems(items, refs)
  return c.json({ items: annotated })
})

ordemItems.post('/', async (c) => {
  const session = c.get('session')
  const body = (await c.req.json()) as {
    category?: unknown; section?: unknown; date?: unknown; data?: unknown
  }

  const category = typeof body.category === 'string' ? resolveCategory(body.category) : null
  if (!category) return c.json({ error: 'Categoria inválida' }, 400)

  const section =
    body.section == null ? null : isOrdemSection(body.section) ? body.section : 'invalid'
  if (section === 'invalid') return c.json({ error: 'Secção inválida' }, 400)
  if (category.scope === 'SECTION' && !section) {
    return c.json({ error: 'Secção é obrigatória' }, 400)
  }
  if (category.scope === 'GROUP' && section) {
    return c.json({ error: 'Categoria de grupo não aceita secção' }, 400)
  }

  if (typeof body.date !== 'string' || isNaN(Date.parse(body.date))) {
    return c.json({ error: 'Data inválida' }, 400)
  }

  const dataResult = validateItemData(category.shape, body.data)
  if (!dataResult.ok) return c.json({ error: dataResult.error }, 400)

  const profile = await loadAuth(session.user.id)
  if (!profile) return c.json({ error: 'Perfil não encontrado' }, 404)

  if (!canManageItem(profile, category, section)) {
    return c.json({ error: 'Sem permissões para esta categoria/secção' }, 403)
  }

  const refError = await validateRefs(category.shape, dataResult.value, section)
  if (refError) return c.json({ error: refError }, 400)

  const item = await prisma.ordemItem.create({
    data: {
      category: category.key,
      section,
      date: new Date(body.date),
      data: dataResult.value as Prisma.InputJsonValue,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })

  return c.json({ item })
})

// SIIE activity import (multipart). Registered before /:id so the static path wins.
ordemItems.post('/import-activities', requireAdmin, async (c) => {
  const session = c.get('session')

  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'Ficheiro não fornecido' }, 400)
  }

  let rows: ActivityRow[]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return c.json({ error: 'Folha vazia' }, 400)
    rows = XLSX.utils.sheet_to_json<ActivityRow>(sheet, { raw: true, defval: null })
  } catch (err) {
    return c.json({ error: `Não foi possível ler o ficheiro: ${(err as Error).message}` }, 400)
  }

  type ImportSummary = {
    total: number; created: number; updated: number; skipped: number
    errors: { row: number; descricao: string; error: string }[]
  }
  type ValidRow = { row: number; payload: ActivityPayload }

  const summary: ImportSummary = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] }

  const valid: ValidRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const mapped = mapActivityRow(rows[i], i + 2)
    if (!mapped.ok) {
      summary.errors.push({ row: mapped.row, descricao: mapped.descricao, error: mapped.error })
      continue
    }
    valid.push({ row: i + 2, payload: mapped.payload })
  }

  if (valid.length === 0) return c.json({ summary })

  const existing = await prisma.ordemItem.findMany({
    where: { externalId: { in: valid.map((v) => v.payload.externalId) } },
    select: { externalId: true, includedInOsId: true },
  })
  const existingMap = new Map(existing.map((e) => [e.externalId as string, e.includedInOsId]))

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
          ok: false, row, descricao: payload.nome,
          error: e.code === 'P2002' ? 'Conflito de unicidade' : e.message ?? 'Erro desconhecido',
        }
      }
    }),
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

  return c.json({ summary })
})

ordemItems.patch('/:id', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')

  const existing = await prisma.ordemItem.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Item não encontrado' }, 404)
  if (existing.includedInOsId) {
    return c.json({ error: 'Item já incluído numa Ordem de Serviço' }, 409)
  }

  const category = resolveCategory(existing.category)
  if (!category) return c.json({ error: 'Categoria inválida' }, 500)

  const profile = await loadAuth(session.user.id)
  if (!profile) return c.json({ error: 'Perfil não encontrado' }, 404)

  const isOwner = existing.createdById === session.user.id
  if (!isOwner && profile.role !== 'ADMIN') {
    return c.json({ error: 'Sem permissões' }, 403)
  }

  const body = (await c.req.json()) as { date?: unknown; data?: unknown; section?: unknown }

  const update: Prisma.OrdemItemUpdateInput = {}
  if (body.date !== undefined) {
    if (typeof body.date !== 'string' || isNaN(Date.parse(body.date))) {
      return c.json({ error: 'Data inválida' }, 400)
    }
    update.date = new Date(body.date)
  }
  if (body.data !== undefined) {
    const r = validateItemData(category.shape, body.data)
    if (!r.ok) return c.json({ error: r.error }, 400)
    update.data = r.value as Prisma.InputJsonValue
  }
  if (body.section !== undefined) {
    if (category.scope === 'GROUP') {
      return c.json({ error: 'Categoria de grupo não aceita secção' }, 400)
    }
    if (!isOrdemSection(body.section)) {
      return c.json({ error: 'Secção inválida' }, 400)
    }
    if (!canManageItem(profile, category, body.section)) {
      return c.json({ error: 'Sem permissões para essa secção' }, 403)
    }
    update.section = body.section
  }

  const item = await prisma.ordemItem.update({
    where: { id },
    data: update,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })
  return c.json({ item })
})

ordemItems.delete('/:id', async (c) => {
  const session = c.get('session')
  const id = c.req.param('id')

  const existing = await prisma.ordemItem.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Item não encontrado' }, 404)
  if (existing.includedInOsId) {
    return c.json({ error: 'Item já incluído numa Ordem de Serviço' }, 409)
  }

  const profile = await loadAuth(session.user.id)
  if (!profile) return c.json({ error: 'Perfil não encontrado' }, 404)
  const isOwner = existing.createdById === session.user.id
  if (!isOwner && profile.role !== 'ADMIN') {
    return c.json({ error: 'Sem permissões' }, 403)
  }

  await prisma.ordemItem.delete({ where: { id } })
  return c.json({ ok: true })
})
