'use client'

import { getAnoEscutistaOptions } from '@/lib/ano-escutista'

interface Props {
  value: number | null
  onChange: (v: number | null) => void
}

export function AnoEscutistaSelector({ value, onChange }: Props) {
  const options = getAnoEscutistaOptions()
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        Ano Escutista:
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.startYear} value={o.startYear}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
