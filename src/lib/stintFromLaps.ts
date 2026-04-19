import type { RawLapRow } from "@/lib/lapExport"

export type Stint = { driver: string; startLap: number; endLap: number }

function trimStr(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function lapNumberFromRow(row: RawLapRow, rowIndex: number): number {
  for (const key of ["L", "LAP", "lap"]) {
    const v = row[key]
    if (typeof v === "number" && Number.isFinite(v)) {
      return v
    }
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number.parseInt(v.trim(), 10)
      if (Number.isFinite(n)) {
        return Math.max(1, n)
      }
    }
  }
  return rowIndex + 1
}

function driverLabel(row: RawLapRow): string | null {
  const d = row.DRIVER ?? row.NAME
  const s = trimStr(d)
  return s !== "" ? s : null
}

/**
 * Group consecutive laps by `DRIVER` or `NAME` when any lap exposes those fields;
 * otherwise a single stint labeled "—".
 */
export function deriveStintsFromLaps(laps: RawLapRow[]): Stint[] {
  if (laps.length === 0) {
    return []
  }

  const rows = laps.map((row, i) => ({
    row,
    lap: lapNumberFromRow(row, i),
  }))
  rows.sort((a, b) => a.lap - b.lap)

  const hasAnyDriver = rows.some(({ row }) => driverLabel(row) !== null)
  if (!hasAnyDriver) {
    const lapsOnly = rows.map((r) => r.lap)
    return [
      {
        driver: "—",
        startLap: Math.min(...lapsOnly),
        endLap: Math.max(...lapsOnly),
      },
    ]
  }

  const stints: Stint[] = []
  let startLap = rows[0]!.lap
  let current = driverLabel(rows[0]!.row) ?? "—"

  for (let i = 1; i < rows.length; i++) {
    const lab = driverLabel(rows[i]!.row) ?? "—"
    const lap = rows[i]!.lap
    if (lab !== current) {
      stints.push({
        driver: current,
        startLap,
        endLap: rows[i - 1]!.lap,
      })
      current = lab
      startLap = lap
    }
  }

  stints.push({
    driver: current,
    startLap,
    endLap: rows[rows.length - 1]!.lap,
  })

  return stints
}
