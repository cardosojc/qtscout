'use client'

import { useState } from 'react'
import type { ScoutCampNightsOut } from '@/lib/api-schemas'

const ACTIVITY_TYPES: Record<string, string> = {
  acamp: 'Acampamento',
  acant: 'Acantonamento',
  bivaq: 'Bivaque',
  raid: 'Raide/Hike',
  jcida: 'Jogo de cidade',
  jmar: 'Grande jogo/Saída mar',
  frm: 'Formação',
  grl: 'Geral',
}

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-PT')

/** Milestones and activity history from the imported SIIE data. */
export function CampNightsHistory({ data }: { data: ScoutCampNightsOut }) {
  const [showAll, setShowAll] = useState(false)
  const activities = showAll ? data.activities : data.activities.slice(0, 5)

  return (
    <div className="space-y-4">
      {data.milestones.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Marcos atingidos (SIIE)
          </h3>
          <ul className="space-y-1 text-sm">
            {data.milestones.map((m) => (
              <li key={m.count} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-gray-900 dark:text-white">{m.count} noites</span>
                <span className="text-gray-600 dark:text-gray-300">
                  em {day(m.reachedOn)} · {m.description}
                </span>
                {m.recordedOn ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    insígnia registada ({day(m.recordedOn)})
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    por registar
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Atividades ({data.activities.length})
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th className="py-1 pr-2 font-medium">Data</th>
              <th className="py-1 pr-2 font-medium">Atividade</th>
              <th className="py-1 pr-2 font-medium">Tipo</th>
              <th className="py-1 font-medium text-right">Noites de campo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {activities.map((a) => (
              <tr key={a.activityId} className="text-gray-800 dark:text-gray-200">
                <td className="py-1 pr-2 whitespace-nowrap">{day(a.startDate)}</td>
                <td className="py-1 pr-2">{a.description}</td>
                <td className="py-1 pr-2 text-gray-500 dark:text-gray-400">
                  {(a.activityType && ACTIVITY_TYPES[a.activityType]) ?? a.activityType ?? '—'}
                </td>
                <td className="py-1 text-right">
                  {a.campNights}
                  {a.campNights !== a.nights && (
                    <span className="text-xs text-gray-500 dark:text-gray-400"> / {a.nights}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.activities.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            {showAll ? 'Mostrar menos' : `Mostrar todas (${data.activities.length})`}
          </button>
        )}
        {data.importedAt && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Importado do SIIE em {day(data.importedAt)}. Noites de campo / noites na atividade
            quando diferem.
          </p>
        )}
      </div>
    </div>
  )
}
