'use client'
import { apiFetch } from '@/lib/api-client'

import { useMemo, useState } from 'react'
import { campNightsKey, refreshCached, useNightsBadges } from '@/lib/api-hooks'
import { useToast } from '@/components/ui/toast'
import { NIGHTS_BADGE_COUNTS, type NightsBadge, type NightsBadgeCount } from '@qtscout/types/scout'

type Props = {
  scoutId: string
  canEdit: boolean
  /** Milestone dates computed from SIIE (yyyy-mm-dd by count), to fill empty ones. */
  suggested?: Partial<Record<NightsBadgeCount, string>>
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

export function NightsBadgesEditor({ scoutId, canEdit, suggested }: Props) {
  const { showToast } = useToast()
  const { data, isLoading: loading, mutate } = useNightsBadges(scoutId)
  // Stored dates per milestone, and the user's unsaved edits on top of them.
  const saved = useMemo(() => {
    const next = emptyValues()
    for (const b of (data?.badges ?? []) as NightsBadge[]) next[b.count] = isoDay(b.awardedAt)
    return next
  }, [data])
  const [edits, setEdits] = useState<Partial<FormValues>>({})
  const values: FormValues = { ...saved, ...edits }
  const setValues = (update: (prev: FormValues) => FormValues) => setEdits(update(values))
  const [submitting, setSubmitting] = useState(false)

  const dirty = NIGHTS_BADGE_COUNTS.some((c) => values[c] !== saved[c])
  // Milestones SIIE says were reached but have no date here yet. Filling them is
  // an unsaved edit: the leader reviews, then saves.
  const fillable = NIGHTS_BADGE_COUNTS.filter((c) => suggested?.[c] && !values[c])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const payload = {
        badges: NIGHTS_BADGE_COUNTS.map((count) => ({
          count,
          awardedAt: values[count] || null,
        })),
      }
      const res = await apiFetch(`/api/scouts/${scoutId}/nights-badges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        showToast('Insígnias guardadas', 'success')
        await mutate()
        setEdits({})
        // The SIIE milestones show which badges are recorded.
        void refreshCached(campNightsKey(scoutId))
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
        <div className="flex justify-end gap-2">
          {fillable.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setValues((prev) => {
                  const next = { ...prev }
                  for (const c of fillable) next[c] = suggested?.[c] ?? ''
                  return next
                })
              }
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg"
            >
              Usar datas do SIIE ({fillable.length})
            </button>
          )}
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
