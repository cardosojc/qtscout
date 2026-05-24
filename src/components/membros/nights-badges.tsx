'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { NIGHTS_BADGE_COUNTS, type NightsBadge, type NightsBadgeCount } from '@/types/scout'

type Props = {
  scoutId: string
  canEdit: boolean
}

type FormValues = Record<NightsBadgeCount, string> // '' if not awarded

function emptyValues(): FormValues {
  return NIGHTS_BADGE_COUNTS.reduce((acc, c) => {
    acc[c] = ''
    return acc
  }, {} as FormValues)
}

function isoDay(value: string): string {
  return value.slice(0, 10)
}

export function NightsBadgesEditor({ scoutId, canEdit }: Props) {
  const { showToast } = useToast()
  const [values, setValues] = useState<FormValues>(emptyValues())
  const [saved, setSaved] = useState<FormValues>(emptyValues())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scouts/${scoutId}/nights-badges`)
      if (!res.ok) return
      const data = (await res.json()) as { badges: NightsBadge[] }
      const next = emptyValues()
      for (const b of data.badges) {
        next[b.count] = isoDay(b.awardedAt)
      }
      setValues(next)
      setSaved(next)
    } finally {
      setLoading(false)
    }
  }, [scoutId])

  useEffect(() => {
    load()
  }, [load])

  const dirty = NIGHTS_BADGE_COUNTS.some((c) => values[c] !== saved[c])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const payload = {
        badges: NIGHTS_BADGE_COUNTS.map((count) => ({
          count,
          awardedAt: values[count] || null,
        })),
      }
      const res = await fetch(`/api/scouts/${scoutId}/nights-badges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        showToast('Insígnias guardadas', 'success')
        setSaved({ ...values })
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao guardar', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 dark:text-gray-300">
        Data em que o membro recebeu cada insígnia. Deixe em branco se ainda
        não foi atribuída.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {NIGHTS_BADGE_COUNTS.map((count) => (
          <div key={count} className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200 w-24 shrink-0">
              {count} noites
            </label>
            <input
              type="date"
              value={values[count]}
              disabled={!canEdit}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [count]: e.target.value }))
              }
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-900"
            />
            {canEdit && values[count] && (
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, [count]: '' }))}
                className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            {submitting ? 'A guardar...' : 'Guardar Insígnias'}
          </button>
        </div>
      )}
    </div>
  )
}
