/** One lap row from `laps-data` / lap export JSON (wire keys vary by feed). */
export type RawLapRow = Record<string, unknown>

function isRecord(x: unknown): x is RawLapRow {
  return x !== null && typeof x === "object" && !Array.isArray(x)
}

function trimStr(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

/**
 * Normalizes lap export JSON to a flat lap array (e.g. `{ DATA: [...] }` from PID 7 / REST).
 */
export function extractLapsFromExport(raw: unknown): RawLapRow[] {
  if (raw === null || raw === undefined) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw.filter(isRecord)
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    for (const key of ["DATA", "data", "LAPS", "laps"]) {
      const v = o[key]
      if (Array.isArray(v)) {
        return v.filter(isRecord)
      }
    }
  }
  return []
}

export function lapNumberLabel(row: RawLapRow, rowIndex: number): string {
  for (const key of ["L", "LAP", "lap"]) {
    const v = row[key]
    const s = trimStr(v)
    if (s !== "") {
      return s
    }
  }
  return String(rowIndex + 1)
}

/** Sector time for column `n` (1–9): `S{n}` first, then `S{n}TIME` (leaderboard-style). */
export function sectorSplitCell(row: RawLapRow, n: number): string {
  const primary = row[`S${n}`]
  const alt = row[`S${n}TIME`]
  return trimStr(primary) || trimStr(alt)
}

/** True if any lap has a non-empty sector split in S1..S9 (or S*n*TIME). */
export function hasPerSectorSplits(laps: RawLapRow[]): boolean {
  for (const row of laps) {
    for (let n = 1; n <= 9; n++) {
      if (sectorSplitCell(row, n) !== "") {
        return true
      }
    }
  }
  return false
}
