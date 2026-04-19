import { formatLapSeconds, parseLapTimeToSeconds } from "@/lib/lapTimes"
import type {
  Pid9002Frame,
  StatisticsBestLapRow,
  StatisticsBestSectorRow,
  StatisticsLeadingRow,
  WireScalar,
} from "@/lib/types"

const EM_DASH = "—"

/** Maximum sector index we consider when summing the theoretical best.
 * Spec documents up to S9 today; we read up to S12 to stay future-proof.
 */
const MAX_SECTOR_INDEX = 12

/** Minimum number of parseable sectors required for a TOTAL theoretical best. */
const MIN_SECTORS_FOR_THEORETICAL = 2

/** Hero KPI for "Schnellste Runde des Rennens". */
export type FastestLapKpi = {
  /** Seconds, e.g. 474.218 */
  seconds: number
  /** Display string, m:ss.SSS via {@link formatLapSeconds}. */
  display: string
  /** Class label, e.g. "SP9" or "TOTAL"; em-dash when missing. */
  classLabel: string
  /** Car number string (already trimmed); em-dash when missing. */
  carNumber: string
}

/** Cockpit KPI summary derived from a single PID 9002 snapshot. */
export type ClassKpis = {
  /** The single fastest lap across the field; null if no usable rows. */
  fastestLap: FastestLapKpi | null
  /**
   * Theoretical best from BESTSECTORS row CLASS=TOTAL — sum of S1..Sn columns.
   * null if there is no TOTAL row, or fewer than two parseable sectors.
   */
  theoreticalBestSeconds: number | null
  /** fastestLap.seconds - theoreticalBestSeconds; null if either side missing. */
  deltaSeconds: number | null
  /** Distinct CLASS values in LEADING excluding "TOTAL" (case-insensitive). */
  activeClasses: number
  /** Raw LEADING row count (for the caption). */
  leadingCount: number
}

function trimmedString(value: WireScalar | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function bestLapsArray(stats: Pid9002Frame | null | undefined): StatisticsBestLapRow[] {
  if (!stats || !Array.isArray(stats.BESTLAPS)) {
    return []
  }
  return stats.BESTLAPS
}

function bestSectorsArray(
  stats: Pid9002Frame | null | undefined
): StatisticsBestSectorRow[] {
  if (!stats || !Array.isArray(stats.BESTSECTORS)) {
    return []
  }
  return stats.BESTSECTORS
}

function leadingArray(stats: Pid9002Frame | null | undefined): StatisticsLeadingRow[] {
  if (!stats || !Array.isArray(stats.LEADING)) {
    return []
  }
  return stats.LEADING
}

function pickFastestLap(rows: StatisticsBestLapRow[]): FastestLapKpi | null {
  let best: { row: StatisticsBestLapRow; seconds: number } | null = null
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue
    }
    const seconds = parseLapTimeToSeconds(row.LAPTIME)
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
      continue
    }
    if (best === null || seconds < best.seconds) {
      best = { row, seconds }
    }
  }
  if (best === null) {
    return null
  }
  return {
    seconds: best.seconds,
    display: formatLapSeconds(best.seconds),
    classLabel: trimmedString(best.row.CLASS) ?? EM_DASH,
    carNumber: trimmedString(best.row.NR) ?? EM_DASH,
  }
}

function findTotalSectorRow(
  rows: StatisticsBestSectorRow[]
): StatisticsBestSectorRow | null {
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue
    }
    const cls = trimmedString(row.CLASS)
    if (cls && cls.toUpperCase() === "TOTAL") {
      return row
    }
  }
  return null
}

function sumTheoreticalSectors(row: StatisticsBestSectorRow): number | null {
  let sum = 0
  let parsed = 0
  for (let i = 1; i <= MAX_SECTOR_INDEX; i++) {
    const key = `S${i}` as keyof StatisticsBestSectorRow
    const seconds = parseLapTimeToSeconds(row[key])
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
      continue
    }
    sum += seconds
    parsed += 1
  }
  if (parsed < MIN_SECTORS_FOR_THEORETICAL) {
    return null
  }
  return sum
}

function countActiveClasses(rows: StatisticsLeadingRow[]): number {
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue
    }
    const cls = trimmedString(row.CLASS)
    if (!cls) {
      continue
    }
    if (cls.toUpperCase() === "TOTAL") {
      continue
    }
    seen.add(cls)
  }
  return seen.size
}

/**
 * Derive the KPI strip values from a PID 9002 snapshot.
 *
 * Defensive against missing payloads, missing arrays, and malformed scalars
 * (numeric/string/null/undefined). Pure function — no React, no store access.
 */
export function classKpis(stats: Pid9002Frame | null | undefined): ClassKpis {
  const bestLaps = bestLapsArray(stats)
  const bestSectors = bestSectorsArray(stats)
  const leading = leadingArray(stats)

  const fastestLap = pickFastestLap(bestLaps)

  const totalRow = findTotalSectorRow(bestSectors)
  const theoreticalBestSeconds = totalRow ? sumTheoreticalSectors(totalRow) : null

  const deltaSeconds =
    fastestLap !== null && theoreticalBestSeconds !== null
      ? fastestLap.seconds - theoreticalBestSeconds
      : null

  return {
    fastestLap,
    theoreticalBestSeconds,
    deltaSeconds,
    activeClasses: countActiveClasses(leading),
    leadingCount: leading.length,
  }
}
