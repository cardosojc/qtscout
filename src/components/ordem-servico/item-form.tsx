'use client'

import { useEffect, useState } from 'react'
import type { CategorySpec, OrdemSection } from '@/types/ordem-item'
import { ORDEM_SECTIONS, ORDEM_SECTION_LABELS } from '@/types/ordem-item'

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

export function ItemForm({ category, defaultSection, allowSectionPicker, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(todayISO())
  const [section, setSection] = useState<OrdemSection | ''>(defaultSection ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Shape-specific fields
  const [value, setValue] = useState('')
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [datas, setDatas] = useState('')
  const [local, setLocal] = useState('')
  const [count, setCount] = useState('1')
  const [membros, setMembros] = useState('')

  useEffect(() => {
    setValue('')
    setNome('')
    setCargo('')
    setDatas('')
    setLocal('')
    setCount('1')
    setMembros('')
  }, [category.key])

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
            membros: membros.split('\n').map((m) => m.trim()).filter(Boolean),
          }
          break
      }
      await onSubmit({
        category: category.key,
        section: category.scope === 'SECTION' ? (section || null) as OrdemSection | null : null,
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
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {category.scope === 'SECTION' && allowSectionPicker && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Secção</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as OrdemSection | '')}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Selecione —</option>
              {ORDEM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {ORDEM_SECTION_LABELS[s]}
                </option>
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
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {category.shape === 'TEXT' && (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          rows={4}
          placeholder={category.label}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={datas}
              onChange={(e) => setDatas(e.target.value)}
              placeholder="Datas (texto livre)"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Local"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Cargo / função"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {category.shape === 'NOITES' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
              Nº de noites
            </label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
              className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
              Membros (um por linha)
            </label>
            <textarea
              value={membros}
              onChange={(e) => setMembros(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
