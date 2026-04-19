import type { RawResultRow, WireScalar } from "./types"

/** Semantic lap / sector status for UI (livetiming wire uses compact codes). */
export type LapSectorStatus =
  | "sessionBest"
  | "personalBest"
  | "pit"
  | "inLap"
  | "outLap"
  | "normal"

/** Known `RESULT` row fields after `decodeResultRow` (wire keys → camelCase; status codes decoded). */
export interface DecodedResultRow {
  position?: WireScalar
  stnr?: WireScalar
  name?: WireScalar
  team?: WireScalar
  car?: WireScalar
  gap?: WireScalar
  chg?: WireScalar
  className?: WireScalar
  pro?: WireScalar
  lastLapTime?: WireScalar
  fastestLap?: WireScalar
  /** From `LLTS` — decoded with `decodeLapStatus`. */
  llts?: LapSectorStatus
  /** From `FLTS` — decoded with `decodeLapStatus`. */
  flts?: LapSectorStatus
  [key: string]: WireScalar | LapSectorStatus | undefined
}

const WIRE_KEY_TO_CAMEL: Record<string, string> = {
  POSITION: "position",
  STNR: "stnr",
  NAME: "name",
  TEAM: "team",
  CAR: "car",
  GAP: "gap",
  CHG: "chg",
  CLASSNAME: "className",
  PRO: "pro",
  LASTLAPTIME: "lastLapTime",
  FASTESTLAP: "fastestLap",
  LLTS: "llts",
  FLTS: "flts",
}

function wireKeyToCamel(wireKey: string): string {
  const sectorTime = /^S(\d+)TIME$/.exec(wireKey)
  if (sectorTime) {
    return `s${sectorTime[1]}Time`
  }
  const sectorStatus = /^ST(\d+)T$/.exec(wireKey)
  if (sectorStatus) {
    return `st${sectorStatus[1]}t`
  }
  const known = WIRE_KEY_TO_CAMEL[wireKey]
  if (known !== undefined) {
    return known
  }
  return wireKey.charAt(0).toLowerCase() + wireKey.slice(1).toLowerCase()
}

function isStatusWireKey(wireKey: string): boolean {
  if (wireKey === "LLTS" || wireKey === "FLTS") {
    return true
  }
  return /^ST\d+T$/.test(wireKey)
}

/**
 * Decode a livetiming lap or sector status code (`LLTS`, `FLTS`, `ST1T`…`ST9T`, etc.) for UI styling.
 *
 * Wire formats vary by feed; this is a **defensive** mapping of common single-character (and a few
 * numeric) codes seen on LLTS / FLTS / ST*n*T-style fields:
 *
 * - **Personal best**: `P` / `p`.
 * - **Session / overall best** (“purple” in broadcast UIs): `O` (overall), `S` (session).
 * - **In lap**: `I`, and numeric `1` (paired with `2` = out lap on some feeds).
 * - **Out lap**: `2`.
 * - **Pit**: `T` / `t` — heuristic for pit stop / tyre-change style flags when distinct from in/out
 *   lap (not all feeds expose this; unknown codes fall through to `normal`).
 *
 * Multi-character values use the **last** non-whitespace character so values like `"0P"` still resolve.
 * Empty, null, or unrecognized values return `normal`.
 */
export function decodeLapStatus(code: WireScalar | undefined): LapSectorStatus {
  if (code === undefined || code === null) {
    return "normal"
  }

  const raw = String(code).trim()
  if (raw === "") {
    return "normal"
  }

  const ch = raw.length === 1 ? raw : raw.replace(/\s+/g, "").slice(-1)
  if (!ch) {
    return "normal"
  }

  const lower = ch.toLowerCase()
  const upper = ch.toUpperCase()

  if (lower === "p") {
    return "personalBest"
  }
  if (upper === "O" || upper === "S") {
    return "sessionBest"
  }
  if (upper === "I" || ch === "1") {
    return "inLap"
  }
  if (ch === "2") {
    return "outLap"
  }
  if (lower === "t") {
    return "pit"
  }

  return "normal"
}

/** Normalize a raw `RESULT` row: camelCase keys and `decodeLapStatus` on lap / sector status fields. */
export function decodeResultRow(raw: RawResultRow): DecodedResultRow {
  const out: Record<string, WireScalar | LapSectorStatus> = {}
  for (const [wireKey, value] of Object.entries(raw)) {
    const camel = wireKeyToCamel(wireKey)
    out[camel] = isStatusWireKey(wireKey)
      ? decodeLapStatus(value)
      : (value ?? null)
  }
  return out as DecodedResultRow
}

/** @deprecated Prefer `decodeLapStatus` — same mapping; string for legacy PRD naming. */
export function decodeStatusCode(code: string | number): string {
  return decodeLapStatus(code)
}
