import type { WireScalar } from "@/domain"

/** Lap row from laps-data `DATA[]` (wire keys). */
export type LapsDataRow = {
  L?: WireScalar
  T?: WireScalar
  [key: string]: WireScalar | undefined
}

export type LapChartPoint = {
  /** Lap index on chart (race lap number from wire `L`). */
  lap: number
  /** Lap time in seconds (for Y axis). */
  seconds: number
  /** Original lap time string for tooltips. */
  lapTimeLabel: string
}

export type AverageMode =
  | "off"
  | "stint"
  | "last5"
  | "last10"
  | "last15"

/**
 * Parse motorsport-style lap time strings to seconds.
 * Supports `ss.xxx`, `m:ss.xxx`, `h:mm:ss.xxx`.
 */
export function parseLapTimeToSeconds(raw: WireScalar | undefined): number | null {
  if (raw === undefined || raw === null) {
    return null
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }
  if (typeof raw !== "string") {
    return null
  }
  const t = raw.trim()
  if (!t || t === "—" || t === "-" || t === "DNF" || t === "DNS") {
    return null
  }
  const parts = t.split(":").map((p) => p.trim())
  if (parts.length === 1) {
    const n = Number.parseFloat(parts[0]!)
    return Number.isFinite(n) ? n : null
  }
  if (parts.length === 2) {
    const m = Number.parseFloat(parts[0]!)
    const sec = Number.parseFloat(parts[1]!)
    if (!Number.isFinite(m) || !Number.isFinite(sec)) {
      return null
    }
    return m * 60 + sec
  }
  if (parts.length === 3) {
    const h = Number.parseFloat(parts[0]!)
    const m = Number.parseFloat(parts[1]!)
    const sec = Number.parseFloat(parts[2]!)
    if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) {
      return null
    }
    return h * 3600 + m * 60 + sec
  }
  return null
}

const LAP_KEYS = ["L", "LAP", "lap", "lapNumber", "LAPNUMBER", "NR"] as const
const TIME_KEYS = [
  "T",
  "t",
  "LAPTIME",
  "lapTime",
  "TIME",
  "time",
  "LASTLAPTIME",
  "LLTS",
] as const

function lapNumberFromRow(row: LapsDataRow, rowIndex: number): number {
  const L = row.L
  if (typeof L === "number" && Number.isFinite(L)) {
    return L
  }
  if (typeof L === "string") {
    const n = Number.parseInt(L, 10)
    if (Number.isFinite(n)) {
      return n
    }
  }
  for (const k of LAP_KEYS) {
    if (k === "L") {
      continue
    }
    const v = row[k as keyof LapsDataRow]
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.max(1, Math.floor(v))
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

function timeFieldFromRow(row: LapsDataRow): WireScalar | undefined {
  for (const k of TIME_KEYS) {
    const v = row[k as keyof LapsDataRow]
    if (v !== undefined && v !== null && v !== "") {
      return v
    }
  }
  return undefined
}

/**
 * Extract a laps array from typical laps-data JSON: top-level array, or `DATA` / `laps` / etc.
 * Returns `null` when the payload shape is not recognized.
 */
function extractLapsRowsFromPayload(payload: unknown): LapsDataRow[] | null {
  if (payload === null || payload === undefined) {
    return null
  }
  if (Array.isArray(payload)) {
    return payload as LapsDataRow[]
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown | LapsDataRow[]>
    for (const key of [
      "DATA",
      "data",
      "laps",
      "LAPS",
      "LapTimes",
      "RESULT",
      "rows",
    ] as const) {
      const v = o[key]
      if (Array.isArray(v)) {
        return v as LapsDataRow[]
      }
    }
  }
  console.warn("[laps] unknown lap payload shape", payload)
  return null
}

/**
 * Build ordered lap series from laps-data JSON (array or `{ DATA: [...] }`, etc.).
 * Returns `null` if the payload shape could not be interpreted; `[]` if there were no valid laps.
 */
export function lapSeriesFromPayload(payload: unknown): LapChartPoint[] | null {
  const data = extractLapsRowsFromPayload(payload)
  if (data === null) {
    return null
  }

  const points: LapChartPoint[] = []
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || typeof row !== "object") {
      continue
    }
    const r = row as LapsDataRow
    const rawT = timeFieldFromRow(r)
    const label =
      typeof rawT === "string" ? rawT.trim() : String(rawT ?? "").trim()
    const seconds = parseLapTimeToSeconds(rawT)
    if (seconds === null) {
      continue
    }
    const lap = lapNumberFromRow(r, i)
    points.push({
      lap,
      seconds,
      lapTimeLabel: label || `${seconds}`,
    })
  }

  if (points.length === 0 && data.length > 0) {
    console.warn("[laps] could not parse any lap times from payload", payload)
  }

  points.sort((a, b) => a.lap - b.lap)
  return points
}

export function personalBestSeconds(points: LapChartPoint[]): number | null {
  if (points.length === 0) {
    return null
  }
  return Math.min(...points.map((p) => p.seconds))
}

export function stintAverageSeconds(points: LapChartPoint[]): number | null {
  if (points.length === 0) {
    return null
  }
  const sum = points.reduce((acc, p) => acc + p.seconds, 0)
  return sum / points.length
}

export function lastNLapsAverageSeconds(
  points: LapChartPoint[],
  n: number
): number | null {
  if (n < 1 || points.length === 0) {
    return null
  }
  const slice = points.slice(-Math.min(n, points.length))
  const sum = slice.reduce((acc, p) => acc + p.seconds, 0)
  return sum / slice.length
}

/** Resolve average line value from mode (or null if off / insufficient data). */
export function resolveAverageSeconds(
  points: LapChartPoint[],
  mode: AverageMode
): number | null {
  if (mode === "off" || points.length === 0) {
    return null
  }
  if (mode === "stint") {
    return stintAverageSeconds(points)
  }
  if (mode === "last5") {
    return lastNLapsAverageSeconds(points, 5)
  }
  if (mode === "last10") {
    return lastNLapsAverageSeconds(points, 10)
  }
  if (mode === "last15") {
    return lastNLapsAverageSeconds(points, 15)
  }
  return null
}

/** Human-readable label for average mode (for legend / select). */
export function averageModeLabel(mode: AverageMode): string {
  switch (mode) {
    case "off":
      return "Off"
    case "stint":
      return "Stint average"
    case "last5":
      return "Last 5 laps"
    case "last10":
      return "Last 10 laps"
    case "last15":
      return "Last 15 laps"
    default:
      return mode
  }
}

/** Format seconds for chart axis and reference labels. */
export function formatLapSeconds(sec: number): string {
  if (!Number.isFinite(sec)) {
    return "—"
  }
  const abs = Math.abs(sec)
  const sign = sec < 0 ? "-" : ""
  if (abs < 60) {
    return `${sign}${abs.toFixed(3)}`
  }
  const m = Math.floor(abs / 60)
  const s = abs - m * 60
  const sStr = s.toFixed(3).padStart(6, "0")
  return `${sign}${m}:${sStr}`
}
