/**
 * Livetiming WebSocket JSON frames (PID = message type).
 *
 * | PID | Role |
 * | --- | --- |
 * | `LTS_TIMESYNC` | Clock sync; must be first after connect. |
 * | `LTS_NOT_FOUND` | Subscription failed (unknown event). |
 * | `0` | Leaderboard snapshot + session header (`RESULT`, `SESSION`, …). |
 * | `3` | Race control messages (`MESSAGES`). |
 * | `4` | Track / session clock (`TRACKSTATE`, `TIMESTATE`, `ENDTIME`, …). |
 * | `501` | Top qualifying (`PRO`, `PROAM`). |
 * | `7` | Per-car lap detail (`DATA[]` with `L`, `T`, sector keys). |
 * | `9002` | Statistics (`LEADING`, `BESTLAPS`, `BESTSECTORS`). |
 *
 * Use {@link LiveTimingPidFrame} for data frames; control frames are
 * {@link LtsTimesyncFrame} and {@link LtsNotFoundFrame}.
 */

/** Scalar values commonly seen on livetiming wire fields. */
export type WireScalar = string | number | boolean | null

/** Server clock sync frame (must be first after connect). */
export interface LtsTimesyncFrame {
  PID: "LTS_TIMESYNC"
  clientLocalTime: number
  serverLocalTime: number
}

/** Emitted when the requested event id is not found on the server. */
export interface LtsNotFoundFrame {
  PID: "LTS_NOT_FOUND"
}

/** Single leaderboard row from PID 0 `RESULT` (wire uses uppercase keys). */
export interface RawResultRow {
  POSITION?: WireScalar
  STNR?: WireScalar
  NAME?: WireScalar
  TEAM?: WireScalar
  CAR?: WireScalar
  GAP?: WireScalar
  CHG?: WireScalar
  CLASSNAME?: WireScalar
  /** Pro / Am bucket (wire). */
  PRO?: WireScalar
  /** Last lap time (wire). */
  LASTLAPTIME?: WireScalar
  /** Fastest lap time (wire). */
  FASTESTLAP?: WireScalar
  /** Last lap time — alternate wire key (e.g. timestamps / Story 5). */
  LLTS?: WireScalar
  /** Fastest lap — alternate wire key. */
  FLTS?: WireScalar
  [key: string]: WireScalar | undefined
}

/** PID 0 — snapshot leaderboard + session metadata. */
export interface Pid0Frame {
  PID: "0"
  RESULT?: RawResultRow[]
  SESSION?: string
  CUP?: string
  HEAT?: string
  HEATTYPE?: string
  TRACKNAME?: string
  STQ?: string | number
  BEST?: WireScalar
  TOD?: string | number
  EXPORTID?: string
  VER?: string
  [key: string]: WireScalar | RawResultRow[] | string | number | undefined
}

/** PID 3 — race control messages. */
export interface RaceMessage {
  ID?: string | number
  MESSAGETIME?: string | number
  MESSAGE?: string
  MESSAGEGROUP?: string
}

export interface Pid3Frame {
  PID: "3"
  MESSAGES?: RaceMessage[]
  [key: string]: WireScalar | RaceMessage[] | undefined
}

/** PID 4 — track / session clock state. */
export interface Pid4Frame {
  PID: "4"
  TRACKSTATE?: string
  TIMESTATE?: string
  ENDTIME?: string | number
  TOD?: string | number
  [key: string]: WireScalar | undefined
}

/** Single row in PID 501 `PRO` / `PROAM` (wire keys; overlaps with `RawResultRow` for STNR, NAME, CAR). */
export interface RawTopQualifyingRow {
  STNR?: WireScalar
  NAME?: WireScalar
  CAR?: WireScalar
  /** Lap / time value (wire). */
  VAL?: WireScalar
  /** Status code (wire), decoded like `LLTS` / `ST*n*T`. */
  ST?: WireScalar
  [key: string]: WireScalar | undefined
}

/** PID 501 — top qualifying buckets. */
export interface Pid501Frame {
  PID: "501"
  PRO?: RawTopQualifyingRow[]
  PROAM?: RawTopQualifyingRow[]
  [key: string]: WireScalar | RawTopQualifyingRow[] | undefined
}

/** Statistics `LEADING[]` row (PID 9002). */
export interface StatisticsLeadingRow {
  CLASS?: WireScalar
  NR?: WireScalar
  LAPS?: WireScalar
  SUM?: WireScalar
  FROMLAP?: WireScalar
  [key: string]: WireScalar | undefined
}

/** Statistics `BESTLAPS[]` row (PID 9002). */
export interface StatisticsBestLapRow {
  CLASS?: WireScalar
  NR?: WireScalar
  INLAP?: WireScalar
  LAPTIME?: WireScalar
  DAYTIME?: WireScalar
  [key: string]: WireScalar | undefined
}

/** Statistics `BESTSECTORS[]` row (PID 9002). */
export interface StatisticsBestSectorRow {
  CLASS?: WireScalar
  LAPTIME?: WireScalar
  S1?: WireScalar
  S2?: WireScalar
  S3?: WireScalar
  S4?: WireScalar
  S5?: WireScalar
  S6?: WireScalar
  S7?: WireScalar
  S8?: WireScalar
  S9?: WireScalar
  [key: string]: WireScalar | undefined
}

/** PID 9002 — statistics snapshots. */
export interface Pid9002Frame {
  PID: "9002"
  LEADING?: StatisticsLeadingRow[]
  BESTLAPS?: StatisticsBestLapRow[]
  BESTSECTORS?: StatisticsBestSectorRow[]
  [key: string]:
    | WireScalar
    | StatisticsLeadingRow[]
    | StatisticsBestLapRow[]
    | StatisticsBestSectorRow[]
    | undefined
}

/** One row in PID 7 `DATA[]` (wire keys `L`, `T`, `S1`…`S9`, `V1`…`V9`). Aligns with `LapsDataRow` in lapTimes. */
export type Pid7DataRow = {
  L?: WireScalar
  T?: WireScalar
  [key: string]: WireScalar | undefined
}

/** PID 7 — per-car lap history (drilldown / laps view). */
export interface Pid7Frame {
  PID: "7"
  EXPORTID?: string
  HEATTYPE?: string
  SESSION?: string
  SECTORS?: WireScalar
  TYPE?: WireScalar
  N?: WireScalar
  DATA?: Pid7DataRow[]
  [key: string]: WireScalar | Pid7DataRow[] | undefined
}

/** All subscribed data frames (numeric string PIDs). */
export type LiveTimingPidFrame =
  | Pid0Frame
  | Pid3Frame
  | Pid4Frame
  | Pid501Frame
  | Pid7Frame
  | Pid9002Frame

/** Parsed WebSocket JSON object with a `PID` (post–timesync data frames). */
export type LiveTimingJsonObject = {
  PID: string
} & Record<string, unknown>

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isLtsTimesyncFrame(msg: unknown): msg is LtsTimesyncFrame {
  if (!isJsonObject(msg)) {
    return false
  }
  return (
    msg.PID === "LTS_TIMESYNC" &&
    typeof msg.clientLocalTime === "number" &&
    typeof msg.serverLocalTime === "number"
  )
}

export function isLtsNotFoundFrame(msg: unknown): msg is LtsNotFoundFrame {
  return isJsonObject(msg) && msg.PID === "LTS_NOT_FOUND"
}

export function isPid0Frame(msg: unknown): msg is Pid0Frame {
  return isJsonObject(msg) && msg.PID === "0"
}

export function isPid3Frame(msg: unknown): msg is Pid3Frame {
  return isJsonObject(msg) && msg.PID === "3"
}

export function isPid4Frame(msg: unknown): msg is Pid4Frame {
  return isJsonObject(msg) && msg.PID === "4"
}

export function isPid501Frame(msg: unknown): msg is Pid501Frame {
  return isJsonObject(msg) && msg.PID === "501"
}

export function isPid9002Frame(msg: unknown): msg is Pid9002Frame {
  return isJsonObject(msg) && msg.PID === "9002"
}

export function isPid7Frame(msg: unknown): msg is Pid7Frame {
  return isJsonObject(msg) && msg.PID === "7"
}
