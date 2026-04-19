import { formatLapSeconds, parseLapTimeToSeconds } from "@/lib/lapTimes"
import type {
  Pid0Frame,
  Pid9002Frame,
  RawResultRow,
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
 * Returns true when the given class label is currently excluded from the stats cockpit.
 * Centralised so bar chart, heatmap, leading table and KPI strip all gate on the
 * same predicate (PRD class-filter band item 5).
 *
 * - Trims input
 * - Empty / null / undefined → never excluded (treated as "no class label")
 * - Comparison is case-sensitive (matches the wire format from PID 9002)
 */
export function isStatsClassExcluded(
  classLabel: WireScalar | undefined,
  excluded: ReadonlySet<string>
): boolean {
  if (classLabel === undefined || classLabel === null) return false
  const s = String(classLabel).trim()
  if (s === "") return false
  return excluded.has(s)
}

/**
 * Filters an array of rows that carry a `CLASS` field by the excluded set.
 * Generic over the row shape to keep callers free of casts.
 *
 * Semantics:
 * - `null` / `undefined` rows → `[]`
 * - Empty excluded set → shallow clone of `rows` (preserves order)
 * - Otherwise drops every row whose trimmed `CLASS` is present in `excluded`
 */
export function filterRowsByExcludedClasses<T extends { CLASS?: WireScalar }>(
  rows: ReadonlyArray<T> | null | undefined,
  excluded: ReadonlySet<string>
): T[] {
  if (!rows || rows.length === 0) return []
  if (excluded.size === 0) return [...rows]
  return rows.filter((r) => !isStatsClassExcluded(r.CLASS, excluded))
}

/**
 * Derive the KPI strip values from a PID 9002 snapshot.
 *
 * Defensive against missing payloads, missing arrays, and malformed scalars
 * (numeric/string/null/undefined). Pure function — no React, no store access.
 *
 * The optional {@link excludedStatsClasses} set drives the same filter the bar
 * chart, sector heatmap and leading table will gate on (PRD class-filter band
 * item 5). It applies to LEADING and BESTLAPS only — the BESTSECTORS `TOTAL`
 * row is a synthetic theoretical limit across the whole field and is never
 * filtered.
 */
export function classKpis(
  stats: Pid9002Frame | null | undefined,
  excludedStatsClasses: ReadonlySet<string> = new Set()
): ClassKpis {
  const bestLaps = filterRowsByExcludedClasses(
    bestLapsArray(stats),
    excludedStatsClasses
  )
  const bestSectors = bestSectorsArray(stats)
  const leading = filterRowsByExcludedClasses(
    leadingArray(stats),
    excludedStatsClasses
  )

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

/**
 * Distinct CLASS labels present in PID 9002, derived from
 * `LEADING ∪ BESTLAPS ∪ BESTSECTORS`. The synthetic `TOTAL` row
 * (case-insensitive) and empty / whitespace values are skipped, so the
 * returned list is the set of real racing classes the spectator can
 * filter on. Sorted alphabetically via `localeCompare`.
 *
 * Pure: never reads from any store.
 */
export function availableStatClasses(
  stats: Pid9002Frame | null | undefined
): string[] {
  const seen = new Set<string>()
  const collectFrom = (
    rows:
      | StatisticsLeadingRow[]
      | StatisticsBestLapRow[]
      | StatisticsBestSectorRow[]
  ): void => {
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue
      }
      const cls = trimmedString(row.CLASS)
      if (!cls) {
        continue
      }
      if (cls.toLowerCase() === "total") {
        continue
      }
      seen.add(cls)
    }
  }

  collectFrom(leadingArray(stats))
  collectFrom(bestLapsArray(stats))
  collectFrom(bestSectorsArray(stats))

  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

/** Tailwind opacity stop chosen by 1-based rank in the sorted bar chart. */
export type BestLapOpacityStop = 100 | 80 | 60 | 40 | 20

/** Floor for the bar fill — slow rows still render a visible nub. */
const MIN_BAR_WIDTH_PCT = 20

/** One row of the best-lap-per-class bar chart, ready for the renderer. */
export type BestLapByClassRow = {
  /** Class label, e.g. "SP9". */
  classLabel: string
  /** Car number string, trimmed; em-dash when missing. */
  carNumber: string
  /** Lap time in seconds. */
  seconds: number
  /** Display string via {@link formatLapSeconds}. */
  display: string
  /** 1-based rank within the sorted-fastest array. */
  rank: number
  /** Width percentage 0–100 for the bar fill (fastest = 100). Clamped to [20, 100]. */
  widthPct: number
  /** Tailwind opacity stop in {100, 80, 60, 40, 20} chosen by rank. */
  opacityStop: BestLapOpacityStop
  /** Day-time string from BESTLAPS row (raw); null if missing. */
  dayTime: string | null
  /**
   * Joined driver / team string from the PID 0 RESULT row whose `STNR`
   * (trimmed) equals the row's `NR` (trimmed). `null` when no snapshot is
   * passed, when no RESULT row matches, or when the matched row carries
   * neither a driver nor a team. See {@link composeDriverTeam} for the exact
   * composition rule.
   */
  driverTeam: string | null
}

/**
 * Compose the driver / team display string for a PID 0 `RESULT` row.
 *
 * Field choices (mirrors the existing project pattern in
 * `src/components/Leaderboard.tsx`, `src/components/PodiumRibbon.tsx`,
 * `src/components/drilldown/DrilldownHeader.tsx` and
 * `src/components/CarDrilldownDialog.tsx`):
 * - **Driver** = `RESULT.NAME` (trimmed). `NAME` is the canonical wire field
 *   for the driver / driver-roster string in PID 0; explicit `DRIVER*`
 *   columns are not present on this WIGE feed (verified Apr 2026).
 * - **Team** = `RESULT.TEAM` (trimmed).
 *
 * Separator is " · " (middle dot, same glyph used by `DrilldownHeader` for
 * `#NR · Driver`). Returns `null` when both sides are empty.
 */
export function composeDriverTeam(row: RawResultRow): string | null {
  const driver = trimmedString(row.NAME)
  const team = trimmedString(row.TEAM)
  if (driver && team) return `${driver} · ${team}`
  return driver || team || null
}

function buildResultIndexByStnr(
  snapshot: Pid0Frame | null | undefined
): Map<string, RawResultRow> {
  const map = new Map<string, RawResultRow>()
  if (!snapshot || !Array.isArray(snapshot.RESULT)) return map
  for (const row of snapshot.RESULT) {
    if (!row || typeof row !== "object") continue
    const stnr = trimmedString(row.STNR)
    if (!stnr) continue
    if (!map.has(stnr)) {
      map.set(stnr, row)
    }
  }
  return map
}

function opacityStopForRank(rank: number): BestLapOpacityStop {
  switch (rank) {
    case 1:
      return 100
    case 2:
      return 80
    case 3:
      return 60
    case 4:
      return 40
    default:
      return 20
  }
}

/**
 * Build the per-class best-lap table sorted ascending by lap time (fastest first).
 *
 * - Source is `stats.BESTLAPS`.
 * - Skips rows whose `CLASS` is empty / "TOTAL" (case-insensitive).
 * - Applies {@link filterRowsByExcludedClasses} for the spectator filter.
 * - Drops rows whose `LAPTIME` is unparseable or non-positive.
 * - `widthPct = (fastestSeconds / row.seconds) * 100`, clamped to [20, 100] so
 *   slow rows still render a visible nub.
 * - `opacityStop` maps by rank: 1→100, 2→80, 3→60, 4→40, anything else→20
 *   (per Stitch Fidelity Contract rule F7).
 *
 * The optional `snapshot` argument is the latest PID 0 frame
 * (`useLiveStore.sessionMeta`). When provided, each row is enriched with a
 * {@link BestLapByClassRow.driverTeam} string composed from the matching
 * `RESULT` row whose trimmed `STNR` equals the BESTLAPS row's trimmed `NR`.
 * When `null` / `undefined`, every `driverTeam` is `null`.
 */
export function bestLapsByClass(
  stats: Pid9002Frame | null | undefined,
  excludedStatsClasses: ReadonlySet<string> = new Set(),
  snapshot: Pid0Frame | null | undefined = null
): BestLapByClassRow[] {
  const filtered = filterRowsByExcludedClasses(
    bestLapsArray(stats),
    excludedStatsClasses
  )

  const resultIndex = buildResultIndexByStnr(snapshot)

  type Parsed = {
    classLabel: string
    carNumber: string
    seconds: number
    dayTime: string | null
    driverTeam: string | null
  }

  const parsed: Parsed[] = []
  for (const row of filtered) {
    if (!row || typeof row !== "object") {
      continue
    }
    const classLabel = trimmedString(row.CLASS)
    if (!classLabel) {
      continue
    }
    if (classLabel.toUpperCase() === "TOTAL") {
      continue
    }
    const seconds = parseLapTimeToSeconds(row.LAPTIME)
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
      continue
    }
    const trimmedNr = trimmedString(row.NR)
    const matched =
      trimmedNr && resultIndex.size > 0 ? (resultIndex.get(trimmedNr) ?? null) : null
    parsed.push({
      classLabel,
      carNumber: trimmedNr ?? EM_DASH,
      seconds,
      dayTime: trimmedString(row.DAYTIME),
      driverTeam: matched ? composeDriverTeam(matched) : null,
    })
  }

  if (parsed.length === 0) {
    return []
  }

  parsed.sort((a, b) => a.seconds - b.seconds)
  const fastest = parsed[0]!.seconds

  return parsed.map((row, index) => {
    const rank = index + 1
    const rawPct = (fastest / row.seconds) * 100
    const widthPct = Math.max(
      MIN_BAR_WIDTH_PCT,
      Math.min(100, Number.isFinite(rawPct) ? rawPct : 0)
    )
    return {
      classLabel: row.classLabel,
      carNumber: row.carNumber,
      seconds: row.seconds,
      display: formatLapSeconds(row.seconds),
      rank,
      widthPct,
      opacityStop: opacityStopForRank(rank),
      dayTime: row.dayTime,
      driverTeam: row.driverTeam,
    }
  })
}

/**
 * Format a signed delta (in seconds) for the "Δ Real → Theoretisch" KPI.
 *
 * Always renders an explicit sign so the analyst sees direction at a glance:
 *   +1.234 → unused potential (real slower than theoretical)
 *   −1.234 → real beat the theoretical (rare; only with stale sectors)
 *   ±0     → identical (or rounded to <1 ms)
 *
 * Uses the typographic minus glyph (U+2212) to match the Stitch design.
 */
export function formatDeltaSeconds(sec: number): string {
  if (!Number.isFinite(sec)) {
    return "—"
  }
  const formatted = formatLapSeconds(Math.abs(sec))
  if (Math.abs(sec) < 0.001) {
    return "±0 s"
  }
  if (sec > 0) {
    return `+${formatted} s`
  }
  return `−${formatted} s`
}
