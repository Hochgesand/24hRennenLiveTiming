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
 * - **Deduplicates per `CLASS`**, keeping only the fastest lap per class. The
 *   WIGE `BESTLAPS` array can carry multiple top laps per class/car (e.g. the
 *   N fastest laps overall), and the chart title "Beste Runde pro Klasse"
 *   commits us to one row per class. Comparison uses the trimmed `CLASS`
 *   string verbatim — no case-folding — so labels coming back as different
 *   spellings ("SP-Pro" vs "SP-PRO") are kept distinct, matching how the
 *   class-filter chips treat them.
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

  // Dedupe per class — keep only the fastest lap per `classLabel`. WIGE's
  // `BESTLAPS` can return several top laps for the same class/car, but this
  // chart promises one row per class.
  const fastestByClass = new Map<string, Parsed>()
  for (const row of parsed) {
    const existing = fastestByClass.get(row.classLabel)
    if (!existing || row.seconds < existing.seconds) {
      fastestByClass.set(row.classLabel, row)
    }
  }
  const deduped = Array.from(fastestByClass.values())

  deduped.sort((a, b) => a.seconds - b.seconds)
  const fastest = deduped[0]!.seconds

  return deduped.map((row, index) => {
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

/** Tailwind opacity stop chosen for a sector heatmap cell. */
export type SectorHeatmapOpacityStop =
  | 100
  | 90
  | 80
  | 70
  | 60
  | 50
  | 40
  | 30
  | 20
  | 10

/** A single heat cell in the sector heatmap. */
export type SectorHeatmapCell = {
  /** Raw sector time in seconds, parsed from `S{n}`. `null` when missing or unparseable. */
  seconds: number | null
  /** Display string for the cell. Empty string when no value. */
  display: string
  /** Tailwind opacity stop. `null` when no value or when the column has no best. */
  opacityStop: SectorHeatmapOpacityStop | null
  /** Delta to the column best, in seconds (>= 0; 0 for the column best). `null` when no value. */
  deltaSeconds: number | null
  /** Relative delta (delta / colBest). `null` when no value or `colBest <= 0`. */
  deltaRel: number | null
  /** True iff this cell is the column best (i.e. the actual minimum and `deltaSeconds === 0`). */
  isColumnBest: boolean
}

/** A heatmap row keyed by class label. */
export type SectorHeatmapRow = {
  classLabel: string
  /** length === sectorCount */
  cells: SectorHeatmapCell[]
  /** Parsed `BESTSECTORS[i].LAPTIME`. `null` when missing or unparseable. */
  lapTimeSeconds: number | null
  /** Display string from {@link formatLapSeconds} or `""` when missing. */
  lapTimeDisplay: string
}

/** Heatmap data ready for the `<SectorHeatmap />` renderer. */
export type SectorHeatmapData = {
  /** Class labels in render order: TOTAL first (when present), then wire order. */
  classes: string[]
  /** 1..9 dynamic via the maximum number of populated `S{n}` columns. */
  sectorCount: number
  /** Best (minimum) seconds per sector column, or `null` when the column is fully empty. */
  columnBestsSeconds: (number | null)[]
  /** Same index alignment as {@link classes}. */
  rows: SectorHeatmapRow[]
}

/**
 * Maximum populated `S{n}` column index (1..9) across the given rows.
 * Mirrors the `maxSectorColumns` helper in `StatisticsPanel.tsx`; kept private
 * to this module to avoid a cross-module coupling on a tiny utility.
 */
function maxSectorColumns(rows: StatisticsBestSectorRow[]): number {
  let max = 0
  for (let n = 1; n <= 9; n++) {
    const key = `S${n}` as keyof StatisticsBestSectorRow
    if (rows.some((r) => trimmedString(r[key]) !== null)) {
      max = n
    }
  }
  return max
}

/**
 * Bin a relative delta (delta / colBest) into the desktop heatmap opacity stop.
 *
 * The PRD describes the binning as "by quantile of (cell − columnBest) / columnBest".
 * Quantile binning is degenerate over typical 3-7 row populations, so we use the
 * documented stable cutoff scheme that matches the Stitch reference rendering
 * (`stats-cockpit-desktop.html` lines 295–334):
 *
 * | deltaRel              | stop |
 * | --------------------- | ---- |
 * | `0` (column best)     | 100  |
 * | `<= 0.005`            |  90  |
 * | `<= 0.010`            |  80  |
 * | `<= 0.020`            |  70  |
 * | `<= 0.030`            |  60  |
 * | `<= 0.050`            |  50  |
 * | `<= 0.075`            |  40  |
 * | `<= 0.100`            |  30  |
 * | `<= 0.150`            |  20  |
 * | else (slowest tier)   |  10  |
 */
function opacityStopForDeltaRel(deltaRel: number): SectorHeatmapOpacityStop {
  if (deltaRel <= 0) return 100
  if (deltaRel <= 0.005) return 90
  if (deltaRel <= 0.01) return 80
  if (deltaRel <= 0.02) return 70
  if (deltaRel <= 0.03) return 60
  if (deltaRel <= 0.05) return 50
  if (deltaRel <= 0.075) return 40
  if (deltaRel <= 0.1) return 30
  if (deltaRel <= 0.15) return 20
  return 10
}

function isTotalClass(label: string | null): boolean {
  return label !== null && label.toUpperCase() === "TOTAL"
}

/**
 * Build the sector heatmap matrix from `PID 9002.BESTSECTORS`.
 *
 * Layout & ordering:
 * - Rows: synthetic `TOTAL` row first (when present), then real classes in the
 *   wire order they first appeared in `BESTSECTORS` (preserves the Stitch order).
 * - Columns: `S1..Sn` where `n = max(1, populated sector index)`. Returns an
 *   all-empty {@link SectorHeatmapData} when no row has any sector value.
 *
 * Filtering:
 * - {@link excludedStatsClasses} filters real classes out of {@link SectorHeatmapData.rows}
 *   AND out of the per-column best computation.
 * - The synthetic `TOTAL` row is **never** filtered, even when "TOTAL" is in
 *   the excluded set, because it represents the absolute reference. It also
 *   participates in the per-column best.
 *
 * Per-cell:
 * - `seconds = parseLapTimeToSeconds(row.S{n})`; `null` when missing /
 *   unparseable / `<= 0`.
 * - `deltaSeconds = seconds - colBest` (>= 0; 0 for the column best).
 * - `deltaRel = deltaSeconds / colBest` (`colBest > 0`).
 * - `opacityStop` per the cutoff scheme documented on
 *   {@link opacityStopForDeltaRel}; `null` when the cell or column has no value.
 *
 * Per-row LAP column:
 * - `lapTimeSeconds = parseLapTimeToSeconds(row.LAPTIME)`,
 *   `lapTimeDisplay = formatLapSeconds(lapTimeSeconds)` (or `""` when missing).
 */
export function sectorHeatmap(
  stats: Pid9002Frame | null | undefined,
  excludedStatsClasses: ReadonlySet<string> = new Set()
): SectorHeatmapData {
  const all = bestSectorsArray(stats)
  if (all.length === 0) {
    return { classes: [], sectorCount: 0, columnBestsSeconds: [], rows: [] }
  }

  const totalRow = findTotalSectorRow(all)
  const nonTotalRows = all.filter((r) => {
    if (!r || typeof r !== "object") return false
    return !isTotalClass(trimmedString(r.CLASS))
  })
  const filteredNonTotal = filterRowsByExcludedClasses(
    nonTotalRows,
    excludedStatsClasses
  )

  const usedRows: StatisticsBestSectorRow[] = []
  if (totalRow) usedRows.push(totalRow)
  usedRows.push(...filteredNonTotal)

  const rawSectorCount = maxSectorColumns(usedRows)
  if (rawSectorCount === 0) {
    return { classes: [], sectorCount: 0, columnBestsSeconds: [], rows: [] }
  }
  const sectorCount = Math.max(1, rawSectorCount)

  type Parsed = {
    classLabel: string
    secondsPerSector: (number | null)[]
    lapTimeSeconds: number | null
  }

  const parsedRows: Parsed[] = []
  for (const row of usedRows) {
    const classLabel = trimmedString(row.CLASS)
    if (!classLabel) continue
    const secondsPerSector: (number | null)[] = []
    for (let i = 1; i <= sectorCount; i++) {
      const key = `S${i}` as keyof StatisticsBestSectorRow
      const seconds = parseLapTimeToSeconds(row[key])
      if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
        secondsPerSector.push(null)
      } else {
        secondsPerSector.push(seconds)
      }
    }
    const lapSeconds = parseLapTimeToSeconds(row.LAPTIME)
    parsedRows.push({
      classLabel,
      secondsPerSector,
      lapTimeSeconds:
        lapSeconds !== null && Number.isFinite(lapSeconds) && lapSeconds > 0
          ? lapSeconds
          : null,
    })
  }

  const columnBestsSeconds: (number | null)[] = []
  for (let i = 0; i < sectorCount; i++) {
    let best: number | null = null
    for (const r of parsedRows) {
      const v = r.secondsPerSector[i]
      if (v === null) continue
      if (best === null || v < best) best = v
    }
    columnBestsSeconds.push(best)
  }

  const rows: SectorHeatmapRow[] = parsedRows.map((p) => {
    const cells: SectorHeatmapCell[] = p.secondsPerSector.map((seconds, i) => {
      if (seconds === null) {
        return {
          seconds: null,
          display: "",
          opacityStop: null,
          deltaSeconds: null,
          deltaRel: null,
          isColumnBest: false,
        }
      }
      const colBest = columnBestsSeconds[i]
      if (colBest === null || colBest <= 0) {
        return {
          seconds,
          display: formatLapSeconds(seconds),
          opacityStop: null,
          deltaSeconds: null,
          deltaRel: null,
          isColumnBest: false,
        }
      }
      const deltaSeconds = seconds - colBest
      const deltaRel = deltaSeconds / colBest
      const isColumnBest = deltaSeconds === 0
      return {
        seconds,
        display: formatLapSeconds(seconds),
        opacityStop: opacityStopForDeltaRel(deltaRel),
        deltaSeconds,
        deltaRel,
        isColumnBest,
      }
    })
    return {
      classLabel: p.classLabel,
      cells,
      lapTimeSeconds: p.lapTimeSeconds,
      lapTimeDisplay:
        p.lapTimeSeconds === null ? "" : formatLapSeconds(p.lapTimeSeconds),
    }
  })

  return {
    classes: rows.map((r) => r.classLabel),
    sectorCount,
    columnBestsSeconds,
    rows,
  }
}

/** A single row in the enriched class-leaders table (PRD Statistik §"enriched leading table"). */
export type EnrichedLeadingRow = {
  /** Class label, e.g. "SP9". em-dash when missing. */
  classLabel: string
  /** Trimmed car number string. em-dash when missing. */
  carNumber: string
  /**
   * Driver / team display from RESULT join via {@link composeDriverTeam}.
   * `null` when no snapshot was passed, when the carNumber has no STNR match,
   * or when the matched RESULT row carries neither driver nor team.
   */
  driverTeam: string | null
  /** Lap count, parsed integer. `null` when missing / unparseable. */
  laps: number | null
  /**
   * Gap to leader. Raw display string from `LEADING.GAP`.
   * - When the row is the leader → `"Leader"` (literal, locale-free).
   * - When not-leader and the wire field is empty after trimming → `"—"`.
   * - Otherwise the trimmed wire string verbatim.
   */
  gap: string
  /** Whether this row is the leader (gap is empty / "0" / "0.000" / "leader"). */
  isLeader: boolean
  /** Total session time. Raw display from `LEADING.SUM`. em-dash when missing. */
  sumDisplay: string
  /**
   * "Seit Runde N" — wire field `FROMLAP` per {@link StatisticsLeadingRow}.
   * `null` when missing or unparseable.
   */
  fromLap: number | null
}

/** Output of {@link enrichedLeading}. Wrapped so future bands can carry per-table chrome. */
export type EnrichedLeadingData = {
  /** Per-class leading rows. Wire order is preserved (one entry per class). */
  rows: EnrichedLeadingRow[]
}

/**
 * Match the trimmed gap value against the documented "this is the leader" forms.
 * Case-insensitive. Empty / whitespace counts as a leader marker (the wire
 * routinely sends an empty `GAP` for the class leader).
 */
function isLeaderGap(trimmed: string): boolean {
  if (trimmed === "") return true
  const lower = trimmed.toLowerCase()
  return lower === "0" || lower === "0.000" || lower === "leader"
}

function parseLaps(value: WireScalar | undefined): number | null {
  if (value === undefined || value === null) return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null
  }
  const trimmed = String(value).trim()
  if (trimmed === "") return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Build the per-class leading rows joined with PID 0 RESULT.STNR for the
 * Statistik tab "Klassen-Führende" table.
 *
 * Source is `stats.LEADING`. Synthetic rows where `CLASS` is empty or
 * `"TOTAL"` (case-insensitive) are filtered out — TOTAL is not a class leader.
 * The {@link excludedStatsClasses} predicate is then applied so the same
 * spectator filter drives the bar chart, heatmap and this table.
 *
 * For each surviving wire row:
 * - `classLabel` = trimmed `CLASS` or `"—"`.
 * - `carNumber` = trimmed `NR` or `"—"`.
 * - `driverTeam` = lookup `snapshot.RESULT[*]` whose trimmed `STNR === carNumber`,
 *   then {@link composeDriverTeam}. `null` otherwise (or when carNumber is `"—"`).
 * - `laps` = `parseInt(LAPS)`; `null` when NaN / missing.
 * - `gap` is the trimmed `GAP` value with the "Leader" rewrite applied per
 *   {@link EnrichedLeadingRow.gap}; `isLeader` mirrors that decision.
 * - `sumDisplay` = trimmed `SUM` or `"—"`.
 * - `fromLap` = parsed integer `FROMLAP` (the wire field documented on
 *   {@link StatisticsLeadingRow}); `null` when missing.
 *
 * Wire order is preserved (the PID 9002 stream delivers leading rows already
 * grouped by class — that is the order Stitch shows). Pure: never reads from
 * any store.
 */
export function enrichedLeading(
  stats: Pid9002Frame | null | undefined,
  snapshot: Pid0Frame | null | undefined = null,
  excludedStatsClasses: ReadonlySet<string> = new Set()
): EnrichedLeadingData {
  const all = leadingArray(stats)
  if (all.length === 0) return { rows: [] }

  const nonTotal = all.filter((row) => {
    if (!row || typeof row !== "object") return false
    const cls = trimmedString(row.CLASS)
    return cls !== null && cls.toUpperCase() !== "TOTAL"
  })
  const filtered = filterRowsByExcludedClasses(nonTotal, excludedStatsClasses)

  const resultIndex = buildResultIndexByStnr(snapshot)

  const rows: EnrichedLeadingRow[] = filtered.map((row) => {
    const classLabel = trimmedString(row.CLASS) ?? EM_DASH
    const carNumberRaw = trimmedString(row.NR)
    const carNumber = carNumberRaw ?? EM_DASH

    const matched =
      carNumberRaw && resultIndex.size > 0
        ? (resultIndex.get(carNumberRaw) ?? null)
        : null
    const driverTeam = matched ? composeDriverTeam(matched) : null

    const gapRaw = trimmedString(row.GAP) ?? ""
    const leader = isLeaderGap(gapRaw)
    const gap = leader ? "Leader" : gapRaw === "" ? EM_DASH : gapRaw

    const sumDisplay = trimmedString(row.SUM) ?? EM_DASH
    const fromLap = parseLaps(row.FROMLAP)
    const laps = parseLaps(row.LAPS)

    return {
      classLabel,
      carNumber,
      driverTeam,
      laps,
      gap,
      isLeader: leader,
      sumDisplay,
      fromLap,
    }
  })

  return { rows }
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
