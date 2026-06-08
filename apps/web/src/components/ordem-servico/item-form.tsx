'use client'
import { apiFetch } from '@/lib/api-client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { CategorySpec, OrdemSection } from '@qtscout/types/ordem-item'
import { ORDEM_SECTIONS, ORDEM_SECTION_LABELS } from '@qtscout/types/ordem-item'
import { scoutDisplayName, type Scout } from '@qtscout/types/scout'

type LeaderProfile = {
  id: string
  name: string | null
  email: string
  section: OrdemSection | null
}

type Props = {
  category: CategorySpec
  defaultSection: OrdemSection | null
  allowSectionPicker: boolean
  onSubmit: (payload: {
    category: string
    section: OrdemSection | null
    date: string
    data: Record<string, unknown>
  }) => Promise<void>
  onCancel: () => void
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const fieldCls =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1'

export function ItemForm({ category, defaultSection, allowSectionPicker, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(todayISO())
  const [section, setSection] = useState<OrdemSection | ''>(defaultSection ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Shape-specific state
  const [value, setValue] = useState('')
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [datas, setDatas] = useState('')
  const [local, setLocal] = useState('')
  const [count, setCount] = useState('1')
  const [scoutId, setScoutId] = useState('')
  const [scoutIds, setScoutIds] = useState<string[]>([])
  const [profileId, setProfileId] = useState('')
  const [refKind, setRefKind] = useState<'scout' | 'profile'>('scout')

  // Pickers' data
  const [scouts, setScouts] = useState<Scout[]>([])
  const [leaders, setLeaders] = useState<LeaderProfile[]>([])

  const needsScoutPicker = ['MEMBER_REF', 'NOITES_REF', 'SCOUT_OR_PROFILE_REF'].includes(category.shape)
  const needsLeaderPicker = ['PROFILE_REF', 'SCOUT_OR_PROFILE_REF'].includes(category.shape)

  useEffect(() => {
    if (!needsScoutPicker) return
    const params = new URLSearchParams()
    if (section) params.set('section', section)
    apiFetch(`/api/scouts?${params.toString()}`)
      .then((r) => r.ok ? r.json() : { scouts: [] })
      .then((d) => setScouts(d.scouts ?? []))
  }, [needsScoutPicker, section])

  useEffect(() => {
    if (!needsLeaderPicker) return
    apiFetch('/api/profiles/leaders')
      .then((r) => r.ok ? r.json() : { profiles: [] })
      .then((d) => setLeaders(d.profiles ?? []))
  }, [needsLeaderPicker])

  // Reset fields when category changes
  useEffect(() => {
    setValue('')
    setNome('')
    setCargo('')
    setDatas('')
    setLocal('')
    setCount('1')
    setScoutId('')
    setScoutIds([])
    setProfileId('')
    setRefKind('scout')
  }, [category.key])

  const sortedScouts = useMemo(
    () => [...scouts].sort((a, b) => scoutDisplayName(a).localeCompare(scoutDisplayName(b))),
    [scouts]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let data: Record<string, unknown> = {}
      switch (category.shape) {
        case 'STRING':
        case 'TEXT':
          data = { value }
          break
        case 'ATIVIDADE':
          data = { nome, datas, local }
          break
        case 'NOMEACAO':
          data = { nome, cargo }
          break
        case 'NOITES':
          data = {
            count: parseInt(count, 10),
            membros: [],
          }
          break
        case 'MEMBER_REF':
          data = { scoutId }
          break
        case 'NOITES_REF':
          data = { count: parseInt(count, 10), scoutIds }
          break
        case 'PROFILE_REF':
          data = { profileId, cargo }
          break
        case 'SCOUT_OR_PROFILE_REF':
          data = { kind: refKind, refId: refKind === 'scout' ? scoutId : profileId, cargo }
          break
      }
      const resolvedSection: OrdemSection | null =
        category.scope === 'GROUP'
          ? null
          : (section || null) as OrdemSection | null
      await onSubmit({
        category: category.key,
        section: resolvedSection,
        date,
        data,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={fieldCls}
          />
        </div>

        {category.scope === 'SECTION' && allowSectionPicker && (
          <div>
            <label className={labelCls}>Secção</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as OrdemSection | '')}
              required
              className={fieldCls}
            >
              <option value="">— Selecione —</option>
              {ORDEM_SECTIONS.map((s) => (
                <option key={s} value={s}>{ORDEM_SECTION_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}

        {category.scope === 'BOTH' && (
          <div>
            <label className={labelCls}>Destino</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as OrdemSection | '')}
              className={fieldCls}
            >
              <option value="">Agrupamento</option>
              {ORDEM_SECTIONS.map((s) => (
                <option key={s} value={s}>{ORDEM_SECTION_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {category.shape === 'STRING' && (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          placeholder={category.label}
          className={fieldCls}
        />
      )}

      {category.shape === 'TEXT' && (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          rows={4}
          placeholder={category.label}
          className={fieldCls}
        />
      )}

      {category.shape === 'ATIVIDADE' && (
        <div className="space-y-2">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Nome da atividade"
            className={fieldCls}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={datas}
              onChange={(e) => setDatas(e.target.value)}
              placeholder="Datas (texto livre)"
              className={fieldCls}
            />
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Local"
              className={fieldCls}
            />
          </div>
        </div>
      )}

      {category.shape === 'NOMEACAO' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Nome"
            className={fieldCls}
          />
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Cargo / função"
            className={fieldCls}
          />
        </div>
      )}

      {category.shape === 'NOITES' && (
        <div>
          <label className={labelCls}>Nº de noites</label>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            required
            className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      {category.shape === 'MEMBER_REF' && (
        <div>
          <label className={labelCls}>Membro</label>
          <select
            value={scoutId}
            onChange={(e) => setScoutId(e.target.value)}
            required
            className={fieldCls}
          >
            <option value="">— Selecione —</option>
            {sortedScouts.map((s) => (
              <option key={s.id} value={s.id}>
                {scoutDisplayName(s)}{s.numeroAssociado ? ` (${s.numeroAssociado})` : ''}
              </option>
            ))}
          </select>
          {sortedScouts.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Sem membros para esta secção. <Link href="/membros" className="underline">Criar primeiro</Link>.
            </p>
          )}
        </div>
      )}

      {category.shape === 'NOITES_REF' && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nº de noites</label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
              className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className={labelCls}>Membros</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {sortedScouts.length === 0 ? (
                <p className="p-3 text-xs text-gray-500 dark:text-gray-400">
                  Sem membros para esta secção.
                </p>
              ) : sortedScouts.map((s) => (
                <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <input
                    type="checkbox"
                    checked={scoutIds.includes(s.id)}
                    onChange={(e) =>
                      setScoutIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                      )
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{scoutDisplayName(s)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {category.shape === 'PROFILE_REF' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Dirigente</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              required
              className={fieldCls}
            >
              <option value="">— Selecione —</option>
              {leaders.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cargo / função</label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>
      )}

      {category.shape === 'SCOUT_OR_PROFILE_REF' && (
        <div className="space-y-2">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setRefKind('scout')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                refKind === 'scout'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Membro
            </button>
            <button
              type="button"
              onClick={() => setRefKind('profile')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                refKind === 'profile'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Dirigente
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{refKind === 'scout' ? 'Membro' : 'Dirigente'}</label>
              {refKind === 'scout' ? (
                <select
                  value={scoutId}
                  onChange={(e) => setScoutId(e.target.value)}
                  required
                  className={fieldCls}
                >
                  <option value="">— Selecione —</option>
                  {sortedScouts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {scoutDisplayName(s)}{s.numeroAssociado ? ` (${s.numeroAssociado})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  required
                  className={fieldCls}
                >
                  <option value="">— Selecione —</option>
                  {leaders.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.email}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelCls}>Cargo / função</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {submitting ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
