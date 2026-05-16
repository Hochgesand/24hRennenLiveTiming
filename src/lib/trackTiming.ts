import { staticClassSpeedMps, FALLBACK_TRACK_AVERAGE_MPS } from "./classSpeedDefaults"
import type { Pid0Frame, RawResultRow, WireScalar } from "./types"

/** Minimum on-track separation in metres (WIGE race-track renderer). */
const MIN_SEPARATION_M = 70

/** Intermediate codes where the car is not shown on track. */
const LEGACY_OFF_TRACK_INTERMEDIATES = new Set([8, 9, 12, 13, 14])
const VER2_OFF_TRACK_INTERMEDIATES = new Set([14, 15, 16, 20])

/** Per-sector velocity sanity bounds (m/s). Outside this range we ignore the measurement. */
const MIN_PLAUSIBLE_MPS = 5
const MAX_PLAUSIBLE_MPS = 110

/** Duration over which the displayed velocity blends from the prior value to the new measurement. */
export const VELOCITY_BLEND_SEC = 5

/**
 * If accumulated drift between the integrated display position and the truthful
 * anchor position grows beyond this on a new crossing, snap rather than coast.
 * Safety valve for outages or pit-loop teleports; never reached in normal racing.
 */
const SNAP_DRIFT_M = 1500

export interface CrossingPoint {
  /** Intermediate code (1..9, clamped). */
  im: number
  /** Server-clock timestamp at the crossing (ms). */
  tMs: number
  /** Cumulative metres at the end of `im`. */
  distanceM: number
}

export interface CarHistory {
  // ----- observations -----
  lastCrossing: CrossingPoint | null
  prevCrossing: CrossingPoint | null
  /** Most recent measured velocity (m/s) — null until two adjacent crossings observed. */
  measuredVelocityMps: number | null
  /** Class-name snapshot used to look up bootstrap speed. */
  className: string

  // ----- velocity blend state -----
  /** Velocity we are blending toward (m/s). */
  targetVelocityMps: number
  /** Velocity at the start of the current blend (m/s). */
  blendStartVelocityMps: number
  /** Server-clock timestamp when the current blend started. */
  blendStartTimeMs: number | null

  // ----- displayed position integrator -----
  displayedDistanceM: number | null
  /** Server-clock timestamp of the previous frame (for dt). */
  lastFrameTimeMs: number | null
}

export type TrackTimingHistory = Map<string, CarHistory>

export interface TrackDriverMarker {
  startingNumber: string
  visible: boolean
  /** Distance along circuit in metres (after overlap separation, wrapped). */
  distanceM: number
  /** Normalised position 0..1 along the SVG path. */
  pathFraction: number
  name: string
  team: string
  /** Overall position text from the wire. */
  position: string
  /** Per-class rank derived from the current snapshot (1 = class leader). */
  classPosition: number | null
  className: string
  gapToLeader: string
  laps: number | null
  trackLengthM: number
  /** Server-clock timestamp of the most recent intermediate crossing. */
  lastCrossingTimeMs: number | null
  /** Currently displayed velocity (m/s). */
  currentVelocityMps: number
}

export interface ComputeTrackDriversInput {
  session: Pid0Frame | null
  /** Prefer PID 4 when present; falls back to PID 0 `TRACKSTATE`. */
  trackState?: WireScalar
  /** Milliseconds to add to `Date.now()` for server-aligned clock. */
  remoteTimeDiffMs: number
  /** SVG path length — only used for the empty-input early-out. */
  trackPathLength: number
  /** Persistent across renders — pass a `useRef(new Map()).current`. */
  history: TrackTimingHistory
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseNum(v: WireScalar | undefined): number | null {
  if (v === undefined || v === null || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function str(v: WireScalar | undefined): string {
  if (v === undefined || v === null) return ""
  return String(v).trim()
}

function getSectorLengthM(session: Pid0Frame, sector: number): number {
  if (sector < 1 || sector > 9) return 0
  const key = `S${sector}L` as keyof Pid0Frame
  return parseNum(session[key] as WireScalar) ?? 0
}

function cumulativeSectorDistanceM(session: Pid0Frame, sector: number): number {
  let dist = 0
  for (let i = 1; i <= sector; i++) dist += getSectorLengthM(session, i)
  return dist
}

/** Cumulative distance at the end of intermediate `im` (WIGE convention). */
function lastIntermediateDistanceM(session: Pid0Frame, im: number): number {
  if (im === 8 || im === 9) {
    const version = str(session.VER)
    if (version !== "2") return 0
  }
  const trackLength = parseNum(session.TRACKLENGTH) ?? 0
  const dist = cumulativeSectorDistanceM(session, Math.min(Math.max(im, 0), 9))
  return trackLength > 0 ? Math.min(dist, trackLength) : dist
}

function isOnTrackIntermediate(session: Pid0Frame, im: number): boolean {
  const offTrack =
    str(session.VER) === "2" ? VER2_OFF_TRACK_INTERMEDIATES : LEGACY_OFF_TRACK_INTERMEDIATES
  return !offTrack.has(im)
}

function wrap(value: number, total: number): number {
  if (total <= 0) return 0
  const v = value % total
  return v < 0 ? v + total : v
}

/** Shortest signed delta along a closed loop (negative = behind target). */
function shortestSignedDelta(from: number, to: number, total: number): number {
  if (total <= 0) return to - from
  let delta = to - from
  if (delta > total / 2) delta -= total
  if (delta < -total / 2) delta += total
  return delta
}

function newHistory(className: string): CarHistory {
  return {
    lastCrossing: null,
    prevCrossing: null,
    measuredVelocityMps: null,
    className,
    targetVelocityMps: 0,
    blendStartVelocityMps: 0,
    blendStartTimeMs: null,
    displayedDistanceM: null,
    lastFrameTimeMs: null,
  }
}

// -----------------------------------------------------------------------------
// Class-average running mean
// -----------------------------------------------------------------------------

/** Aggregate currently-known measured velocities per class. */
function classRunningMeans(history: TrackTimingHistory): Map<string, number> {
  const sum = new Map<string, { total: number; count: number }>()
  for (const car of history.values()) {
    if (car.measuredVelocityMps == null) continue
    const key = car.className
    const entry = sum.get(key) ?? { total: 0, count: 0 }
    entry.total += car.measuredVelocityMps
    entry.count += 1
    sum.set(key, entry)
  }
  const means = new Map<string, number>()
  for (const [k, { total, count }] of sum) means.set(k, total / count)
  return means
}

function bootstrapVelocity(className: string, runningMeans: Map<string, number>): number {
  const mean = runningMeans.get(className)
  if (mean !== undefined && Number.isFinite(mean) && mean > 0) return mean
  return staticClassSpeedMps(className) || FALLBACK_TRACK_AVERAGE_MPS
}

// -----------------------------------------------------------------------------
// Velocity blend (smooth target retargeting on each new measurement)
// -----------------------------------------------------------------------------

/** Currently displayed velocity at `serverNowMs`, interpolated across an active blend. */
export function currentBlendedVelocity(car: CarHistory, serverNowMs: number): number {
  if (car.blendStartTimeMs == null) return car.targetVelocityMps
  const dt = (serverNowMs - car.blendStartTimeMs) / 1000
  if (dt >= VELOCITY_BLEND_SEC) return car.targetVelocityMps
  if (dt <= 0) return car.blendStartVelocityMps
  const k = dt / VELOCITY_BLEND_SEC
  return car.blendStartVelocityMps + (car.targetVelocityMps - car.blendStartVelocityMps) * k
}

function retargetVelocity(car: CarHistory, newTarget: number, serverNowMs: number): void {
  // Start the new blend from whatever the currently displayed velocity is.
  car.blendStartVelocityMps = currentBlendedVelocity(car, serverNowMs)
  car.targetVelocityMps = newTarget
  car.blendStartTimeMs = serverNowMs
}

// -----------------------------------------------------------------------------
// Per-row observation update + integrator
// -----------------------------------------------------------------------------

function ingestCrossing(
  car: CarHistory,
  session: Pid0Frame,
  im: number,
  tMs: number,
  trackLengthM: number,
): boolean {
  // Same anchor as before → no new observation.
  if (car.lastCrossing && car.lastCrossing.tMs === tMs && car.lastCrossing.im === im) {
    return false
  }
  // Stale (older timestamp than what we already saw) → reject.
  if (car.lastCrossing && tMs < car.lastCrossing.tMs) {
    return false
  }

  const distanceM = lastIntermediateDistanceM(session, im)
  const nextCrossing: CrossingPoint = { im, tMs, distanceM }
  car.prevCrossing = car.lastCrossing
  car.lastCrossing = nextCrossing

  // Compute measured velocity from the just-completed sector if possible.
  if (car.prevCrossing) {
    const dtSec = (nextCrossing.tMs - car.prevCrossing.tMs) / 1000
    if (dtSec > 0) {
      // Wrap-aware metre delta.
      let dM = nextCrossing.distanceM - car.prevCrossing.distanceM
      if (dM <= 0 && trackLengthM > 0) dM += trackLengthM
      if (dM > 0) {
        const v = dM / dtSec
        if (v >= MIN_PLAUSIBLE_MPS && v <= MAX_PLAUSIBLE_MPS) {
          car.measuredVelocityMps = v
        }
      }
    }
  }
  return true
}

function advanceDisplayed(
  car: CarHistory,
  serverNowMs: number,
  trackLengthM: number,
  bootstrapV: number,
  hadFreshCrossing: boolean,
): number {
  if (!car.lastCrossing) return Number.NaN

  // First frame for this car → snap to anchor at bootstrap velocity.
  if (car.displayedDistanceM == null) {
    const elapsedSec = Math.max(0, (serverNowMs - car.lastCrossing.tMs) / 1000)
    const v = car.measuredVelocityMps ?? bootstrapV
    car.targetVelocityMps = v
    car.blendStartVelocityMps = v
    car.blendStartTimeMs = null
    car.displayedDistanceM = wrap(car.lastCrossing.distanceM + v * elapsedSec, trackLengthM)
    car.lastFrameTimeMs = serverNowMs
    return car.displayedDistanceM
  }

  // On a fresh crossing: retarget velocity (with optional snap on severe drift).
  if (hadFreshCrossing) {
    const newTarget = car.measuredVelocityMps ?? bootstrapV
    // Has displayed position drifted egregiously from the truthful anchor?
    const elapsedSec = Math.max(0, (serverNowMs - car.lastCrossing.tMs) / 1000)
    const truthfulPos = wrap(car.lastCrossing.distanceM + newTarget * elapsedSec, trackLengthM)
    const drift = Math.abs(shortestSignedDelta(car.displayedDistanceM, truthfulPos, trackLengthM))
    if (drift > SNAP_DRIFT_M) {
      car.displayedDistanceM = truthfulPos
      car.targetVelocityMps = newTarget
      car.blendStartVelocityMps = newTarget
      car.blendStartTimeMs = null
    } else if (newTarget !== car.targetVelocityMps) {
      retargetVelocity(car, newTarget, serverNowMs)
    }
  }

  // Integrate displayed position by the currently blended velocity.
  const dt =
    car.lastFrameTimeMs != null
      ? Math.max(0, (serverNowMs - car.lastFrameTimeMs) / 1000)
      : 0
  const v = currentBlendedVelocity(car, serverNowMs)
  car.displayedDistanceM = wrap(car.displayedDistanceM + v * dt, trackLengthM)
  car.lastFrameTimeMs = serverNowMs
  return car.displayedDistanceM
}

// -----------------------------------------------------------------------------
// WIGE overlap separation (port of trackPositions.ts logic, simpler shape)
// -----------------------------------------------------------------------------

interface WorkingRow {
  stnr: string
  rawRow: RawResultRow
  im: number | null
  onTrack: boolean
  dist: number
  restoreDist?: boolean
}

function separatePair(a: WorkingRow, b: WorkingRow): void {
  const gap = Math.abs(b.dist - a.dist)
  const push = MIN_SEPARATION_M - gap
  if (push > 0) a.dist -= push
}

function sortForSeparation(rows: WorkingRow[]): void {
  rows.sort((a, b) => {
    if (a.dist !== b.dist) return b.dist - a.dist
    const imA = a.im ?? 0
    const imB = b.im ?? 0
    return imB - imA
  })
}

export function separateDriverDistances(rows: WorkingRow[], trackLengthM: number): void {
  if (rows.length === 0 || trackLengthM <= 0) return

  sortForSeparation(rows)
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) separatePair(rows[i], rows[j])
  }

  for (const row of rows) {
    if (row.dist <= MIN_SEPARATION_M) {
      row.dist += trackLengthM
      row.restoreDist = true
    } else {
      row.restoreDist = false
    }
  }

  sortForSeparation(rows)
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) separatePair(rows[i], rows[j])
  }

  for (const row of rows) {
    if (row.restoreDist) {
      row.dist -= trackLengthM
      row.restoreDist = false
    }
  }
}

// -----------------------------------------------------------------------------
// Derived per-class position + lap count
// -----------------------------------------------------------------------------

function deriveClassPositions(rows: RawResultRow[]): Map<string, number> {
  const byClass = new Map<string, Array<{ stnr: string; pos: number }>>()
  for (const row of rows) {
    const stnr = str(row.STNR)
    if (!stnr) continue
    const className = str(row.CLASSNAME)
    if (!className) continue
    const pos = parseNum(row.POSITION) ?? Number.POSITIVE_INFINITY
    const arr = byClass.get(className) ?? []
    arr.push({ stnr, pos })
    byClass.set(className, arr)
  }
  const out = new Map<string, number>()
  for (const arr of byClass.values()) {
    arr.sort((a, b) => a.pos - b.pos)
    arr.forEach(({ stnr }, i) => out.set(stnr, i + 1))
  }
  return out
}

function lapsForRow(row: RawResultRow): number | null {
  return parseNum(row.LAPS) ?? parseNum(row.NRLAPS) ?? parseNum(row.LAPCOUNT)
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export function computeTrackDrivers(input: ComputeTrackDriversInput): TrackDriverMarker[] {
  const { session, trackState, remoteTimeDiffMs, trackPathLength, history } = input
  if (!session?.RESULT?.length) return []

  const trackLengthM = parseNum(session.TRACKLENGTH)
  if (trackLengthM === null || trackLengthM <= 0 || trackPathLength <= 0) return []

  const state =
    trackState !== undefined && trackState !== null
      ? String(trackState)
      : session.TRACKSTATE !== undefined && session.TRACKSTATE !== null
        ? String(session.TRACKSTATE)
        : "0"
  const trackHidden = state === "1" || state === "2" || state === "Code 60"

  const serverNowMs = Date.now() + remoteTimeDiffMs

  // ----- Ingest all crossings first, so running means see new measurements -----
  const freshById = new Map<string, boolean>()
  for (const row of session.RESULT) {
    const stnr = str(row.STNR)
    if (!stnr) continue
    const im = parseNum(row.LASTINTERMEDIATENUMBER)
    const tMs = parseNum(row.LASTIMTIME)
    if (im === null || tMs === null) continue
    const className = str(row.CLASSNAME)
    let car = history.get(stnr)
    if (!car) {
      car = newHistory(className)
      history.set(stnr, car)
    } else if (className && car.className !== className) {
      car.className = className
    }
    const fresh = ingestCrossing(car, session, im, tMs + remoteTimeDiffMs, trackLengthM)
    freshById.set(stnr, fresh)
  }

  const runningMeans = classRunningMeans(history)
  const classPositions = deriveClassPositions(session.RESULT)

  // ----- Advance integrator + assemble working rows for separation -----
  const working: WorkingRow[] = []
  for (const row of session.RESULT) {
    const stnr = str(row.STNR)
    if (!stnr) continue
    const im = parseNum(row.LASTINTERMEDIATENUMBER)
    const car = history.get(stnr)
    let dist = 0
    let onTrack = false

    if (car && !trackHidden && im !== null && isOnTrackIntermediate(session, im)) {
      const bootstrapV = bootstrapVelocity(car.className, runningMeans)
      const displayed = advanceDisplayed(
        car,
        serverNowMs,
        trackLengthM,
        bootstrapV,
        freshById.get(stnr) === true,
      )
      if (Number.isFinite(displayed)) {
        dist = displayed
        onTrack = true
      }
    }

    working.push({ stnr, rawRow: row, im, onTrack, dist })
  }

  const onTrackRows = working.filter((r) => r.onTrack)
  separateDriverDistances(onTrackRows, trackLengthM)

  // ----- Assemble final markers -----
  return working.map((w) => {
    const row = w.rawRow
    const car = history.get(w.stnr)
    const distM = wrap(w.dist, trackLengthM)
    const fraction = trackLengthM > 0 ? distM / trackLengthM : 0
    return {
      startingNumber: w.stnr,
      visible: w.onTrack && w.stnr !== "",
      distanceM: distM,
      pathFraction: Math.max(0, Math.min(1, fraction)),
      name: str(row.NAME),
      team: str(row.TEAM),
      position: str(row.POSITION),
      classPosition: classPositions.get(w.stnr) ?? null,
      className: str(row.CLASSNAME),
      gapToLeader: str(row.GAP),
      laps: lapsForRow(row),
      trackLengthM,
      lastCrossingTimeMs: car?.lastCrossing?.tMs ?? null,
      currentVelocityMps: car ? currentBlendedVelocity(car, serverNowMs) : 0,
    }
  })
}
