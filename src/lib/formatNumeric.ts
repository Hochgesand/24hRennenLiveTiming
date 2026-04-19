/**
 * Motorsport-style numeric formatting for {@link DataNumeric}.
 * Locale-independent: always `.` decimal separator for data density.
 */

export type NumericKind =
  | "lapTime"
  | "sector"
  | "gap"
  | "delta"
  | "position"
  | "int"

function isDashLike(raw: string): boolean {
  const t = raw.trim()
  return t === "" || t === "—" || t === "-" || t === "DNF" || t === "DNS"
}

/** Parse a lap/sector time string to seconds, or null if not parseable. */
export function parseTimeToSeconds(raw: string): number | null {
  const t = raw.trim()
  if (!t || isDashLike(t)) {
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

function formatSecondsAsLapTime(sec: number): string {
  const abs = Math.abs(sec)
  const sign = sec < 0 ? "-" : ""
  if (abs < 60) {
    return `${sign}${abs.toFixed(3)}`
  }
  const m = Math.floor(abs / 60)
  const s = abs - m * 60
  return `${sign}${m}:${s.toFixed(3).padStart(6, "0")}`
}

/** Format gap / delta in seconds: one decimal up to ±99.9, else lap-style. */
export function formatGapSeconds(sec: number): string {
  if (!Number.isFinite(sec)) {
    return "—"
  }
  const abs = Math.abs(sec)
  if (abs <= 99.9) {
    const sign = sec < 0 ? "-" : sec > 0 ? "+" : ""
    return `${sign}${abs.toFixed(1)}`
  }
  return formatSecondsAsLapTime(sec)
}

export function formatDataNumeric(
  value: unknown,
  kind: NumericKind
): { text: string; deltaSign: "neg" | "zero" | "pos" | null } {
  if (value === undefined || value === null) {
    return { text: "—", deltaSign: null }
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { text: "—", deltaSign: null }
    }
    if (kind === "position" || kind === "int") {
      return { text: String(Math.trunc(value)), deltaSign: null }
    }
    if (kind === "delta") {
      if (value === 0) {
        return { text: formatGapSeconds(0), deltaSign: "zero" }
      }
      return {
        text: formatGapSeconds(value),
        deltaSign: value < 0 ? "neg" : "pos",
      }
    }
    if (kind === "gap") {
      return { text: formatGapSeconds(value), deltaSign: null }
    }
    return { text: String(value), deltaSign: null }
  }

  const s = String(value).trim()
  if (kind === "position" || kind === "int") {
    if (s === "" || isDashLike(s)) {
      return { text: "—", deltaSign: null }
    }
    const n = Number.parseInt(s, 10)
    return { text: Number.isFinite(n) ? String(n) : s, deltaSign: null }
  }

  if (s === "" || isDashLike(s)) {
    return { text: "—", deltaSign: null }
  }

  if (kind === "lapTime" || kind === "sector") {
    const sec = parseTimeToSeconds(s)
    if (sec === null) {
      return { text: s, deltaSign: null }
    }
    return { text: formatSecondsAsLapTime(sec), deltaSign: null }
  }

  if (kind === "gap") {
    const leader = /^[–—-]$/.test(s) || /^0(\.0)?s?$/i.test(s)
    if (leader) {
      return { text: "—", deltaSign: null }
    }
    const sec = parseTimeToSeconds(s)
    if (sec !== null) {
      return { text: formatGapSeconds(sec), deltaSign: null }
    }
    const n = Number.parseFloat(s.replace(/^\+/, ""))
    if (Number.isFinite(n)) {
      return { text: formatGapSeconds(n), deltaSign: null }
    }
    return { text: s, deltaSign: null }
  }

  if (kind === "delta") {
    const n = Number.parseFloat(s.replace(/^\+/, ""))
    if (!Number.isFinite(n)) {
      return { text: s, deltaSign: null }
    }
    if (n === 0) {
      return { text: formatGapSeconds(0), deltaSign: "zero" }
    }
    return {
      text: formatGapSeconds(n),
      deltaSign: n < 0 ? "neg" : "pos",
    }
  }

  return { text: s, deltaSign: null }
}
