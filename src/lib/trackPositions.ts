import type { Pid0Frame, RawResultRow, WireScalar } from "./types"

/** Minimum on-track separation in metres (WIGE race-track renderer). */
const MIN_SEPARATION_M = 70

/** Intermediate codes where the car is not shown on track. */
const LEGACY_OFF_TRACK_INTERMEDIATES = new Set([8, 9, 12, 13, 14])
const VER2_OFF_TRACK_INTERMEDIATES = new Set([14, 15, 16, 20])

export type TrackDriverMarker = {
  startingNumber: string
  visible: boolean
  /** Distance along circuit in metres (after overlap separation). */
  distanceM: number
  /** Normalised position 0..1 along the SVG path. */
  pathFraction: number
  name: string
  team: string
  position: string
  className: string
}

export type ComputeTrackDriversInput = {
  session: Pid0Frame | null
  /** Prefer PID 4 when present; falls back to PID 0 `TRACKSTATE`. */
  trackState?: WireScalar
  remoteTimeDiffMs: number
  trackPathLength: number
}

function parseNum(v: WireScalar | undefined): number | null {
  if (v === undefined || v === null || v === "") {
    return null
  }
  const n = typeof v === "number" ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function str(v: WireScalar | undefined): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function getSectorLengthM(session: Pid0Frame, sector: number): number {
  if (sector < 1 || sector > 9) {
    return 0
  }
  const key = `S${sector}L` as keyof Pid0Frame
  return parseNum(session[key] as WireScalar) ?? 0
}

function cumulativeSectorDistanceM(session: Pid0Frame, sector: number): number {
  let dist = 0
  for (let i = 1; i <= sector; i++) {
    dist += getSectorLengthM(session, i)
  }
  return dist
}

/** Cumulative distance to the end of intermediate `im` (WIGE `getLastIntermediateLength`). */
function lastIntermediateDistanceM(session: Pid0Frame, im: number): number {
  if (im === 8 || im === 9) {
    const version = str(session.VER)
    if (version !== "2") {
      return 0
    }
  }
  const trackLength = parseNum(session.TRACKLENGTH) ?? 0
  const dist = cumulativeSectorDistanceM(session, Math.min(Math.max(im, 0), 9))
  return trackLength > 0 ? Math.min(dist, trackLength) : dist
}

/** Distance to the next intermediate boundary (WIGE `getNextIntermediateLength`). */
function nextIntermediateDistanceM(session: Pid0Frame, im: number): number {
  const trackLength = parseNum(session.TRACKLENGTH) ?? 0
  const numIm = parseNum(session.NROFINTERMEDIATETIMES)
  if (numIm !== null && im === numIm) {
    return trackLength
  }
  const dist = cumulativeSectorDistanceM(session, Math.min(Math.max(im + 1, 0), 9))
  return trackLength > 0 ? Math.min(dist, trackLength) : dist
}

/** WIGE `calculateDistance` for one car row. */
export function calculateRowDistanceM(
  session: Pid0Frame,
  row: RawResultRow,
  timeOfDayMs: number,
): number {
  const trackLength = parseNum(session.TRACKLENGTH)
  if (trackLength === null || trackLength <= 0) {
    return 0
  }

  const im = parseNum(row.LASTINTERMEDIATENUMBER)
  if (im === null) {
    return trackLength
  }

  const lastDist = lastIntermediateDistanceM(session, im)
  const lastImTime = parseNum(row.LASTIMTIME)
  const eta = parseNum(row.ETA)
  if (lastImTime === null || eta === null) {
    return lastDist
  }

  const nextBound = nextIntermediateDistanceM(session, im)
  const segmentLength = Math.max(0, nextBound - lastDist)
  const elapsedSec = (timeOfDayMs - lastImTime) / 1000
  const segmentSec = (eta - lastImTime) / 1000
  if (segmentSec <= 0) {
    return lastDist
  }

  const progress = Math.max(0, Math.min(1, elapsedSec / segmentSec))
  const interpolated = lastDist + segmentLength * progress
  const dist = Math.min(Math.trunc(interpolated), nextBound)
  return Number.isNaN(dist) ? trackLength : dist
}

function isOnTrackIntermediate(session: Pid0Frame, im: number): boolean {
  const offTrack =
    str(session.VER) === "2" ? VER2_OFF_TRACK_INTERMEDIATES : LEGACY_OFF_TRACK_INTERMEDIATES
  return !offTrack.has(im)
}

type WorkingRow = RawResultRow & {
  DIST: number
  ONTRACK: boolean
  restoreDist?: boolean
}

function applyTrackState(
  session: Pid0Frame,
  row: RawResultRow,
  trackState: string,
  timeOfDayMs: number,
): WorkingRow {
  const w = { ...row, DIST: 0, ONTRACK: false } as WorkingRow
  const state = trackState.trim()

  if (state === "1" || state === "2" || state === "Code 60") {
    return w
  }

  if (state !== "0") {
    return w
  }

  const im = parseNum(row.LASTINTERMEDIATENUMBER)
  if (im === null || !isOnTrackIntermediate(session, im)) {
    return w
  }

  w.ONTRACK = true
  w.DIST = calculateRowDistanceM(session, row, timeOfDayMs)
  return w
}

function separatePair(a: WorkingRow, b: WorkingRow): void {
  const gap = Math.abs(b.DIST - a.DIST)
  const push = MIN_SEPARATION_M - gap
  if (push > 0) {
    a.DIST -= push
  }
}

function sortForSeparation(rows: WorkingRow[]): void {
  rows.sort((a, b) => {
    if (a.DIST !== b.DIST) {
      return b.DIST - a.DIST
    }
    const imA = parseNum(a.LASTINTERMEDIATENUMBER) ?? 0
    const imB = parseNum(b.LASTINTERMEDIATENUMBER) ?? 0
    if (imA !== imB) {
      return imB - imA
    }
    const etaA = parseNum(a.ETA) ?? 0
    const etaB = parseNum(b.ETA) ?? 0
    return etaB - etaA
  })
}

/** WIGE overlap separation on metre distances before mapping to SVG. */
export function separateDriverDistances(
  rows: WorkingRow[],
  trackLengthM: number,
): void {
  if (rows.length === 0 || trackLengthM <= 0) {
    return
  }

  sortForSeparation(rows)
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) {
      separatePair(rows[i], rows[j])
    }
  }

  for (const row of rows) {
    if (row.DIST <= MIN_SEPARATION_M) {
      row.DIST += trackLengthM
      row.restoreDist = true
    } else {
      row.restoreDist = false
    }
  }

  sortForSeparation(rows)
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) {
      separatePair(rows[i], rows[j])
    }
  }

  for (const row of rows) {
    if (row.restoreDist) {
      row.DIST -= trackLengthM
      row.restoreDist = false
    }
  }
}

/**
 * Derive live car markers from PID 0 leaderboard timing (WIGE race-track algorithm).
 */
export function computeTrackDrivers(input: ComputeTrackDriversInput): TrackDriverMarker[] {
  const { session, trackState, remoteTimeDiffMs, trackPathLength } = input
  if (!session?.RESULT?.length) {
    return []
  }

  const trackLengthM = parseNum(session.TRACKLENGTH)
  if (trackLengthM === null || trackLengthM <= 0 || trackPathLength <= 0) {
    return []
  }

  const state =
    trackState !== undefined && trackState !== null
      ? String(trackState)
      : session.TRACKSTATE !== undefined && session.TRACKSTATE !== null
        ? String(session.TRACKSTATE)
        : "0"

  const serverNowMs = Date.now() + remoteTimeDiffMs

  const working: WorkingRow[] = session.RESULT.map((row) => {
    const adjusted: RawResultRow = { ...row }
    const eta = parseNum(row.ETA)
    const lastIm = parseNum(row.LASTIMTIME)
    if (eta !== null) {
      adjusted.ETA = eta + remoteTimeDiffMs
    }
    if (lastIm !== null) {
      adjusted.LASTIMTIME = lastIm + remoteTimeDiffMs
    }
    return applyTrackState(session, adjusted, state, serverNowMs)
  })

  const onTrack = working.filter((r) => r.ONTRACK)
  separateDriverDistances(onTrack, trackLengthM)

  return working.map((row) => {
    const fraction = Math.max(0, Math.min(1, row.DIST / trackLengthM))
    return {
      startingNumber: str(row.STNR),
      visible: row.ONTRACK && str(row.STNR) !== "",
      distanceM: row.DIST,
      pathFraction: fraction,
      name: str(row.NAME),
      team: str(row.TEAM),
      position: str(row.POSITION),
      className: str(row.CLASSNAME),
    }
  })
}
