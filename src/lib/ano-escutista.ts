// Returns the start year of the Ano Escutista that contains `date`
// Rule: if date >= Sep 30 of year Y → ano Y/Y+1; otherwise ano (Y-1)/Y
export function getAnoEscutistaStartYear(date: Date = new Date()): number {
  const y = date.getFullYear()
  const m = date.getMonth() + 1 // 1-based
  const d = date.getDate()
  return m > 9 || (m === 9 && d >= 30) ? y : y - 1
}

export type AnoEscutista = {
  startYear: number
  label: string  // "2025/2026"
  from: string   // "2025-09-30"  (ISO date, for API / <input type="date">)
  to: string     // "2026-10-31"
}

export function getAnoEscutistaRange(startYear: number): AnoEscutista {
  return {
    startYear,
    label: `${startYear}/${startYear + 1}`,
    from: `${startYear}-09-30`,
    to:   `${startYear + 1}-10-31`,
  }
}

export function getCurrentAnoEscutista(): AnoEscutista {
  return getAnoEscutistaRange(getAnoEscutistaStartYear())
}

// Returns options from 2020 up to the current ano + 1
export function getAnoEscutistaOptions(): AnoEscutista[] {
  const current = getAnoEscutistaStartYear()
  const options: AnoEscutista[] = []
  for (let y = 2020; y <= current + 1; y++) {
    options.push(getAnoEscutistaRange(y))
  }
  return options.reverse() // newest first
}
