import { SECTOR_END_POINTS } from "@/assets/nuerburgring24h"
import type { Pid0Frame, WireScalar } from "@/domain"

/** Nine sector arcs, each resolved as one or more spans along the main track path. */
export type SectorSpan = { startLen: number; endLen: number }

export type TimingSectorLengths = {
  trackLengthM: number
  sectorLengthsM: number[]
}

export type SectorGeometry = {
  /** Total path length, in SVG user units. */
  totalLength: number
  /** One entry per sector; may contain two spans when the sector wraps. */
  sectors: SectorSpan[][]
  /** Marker positions (end of each sector) in viewBox coords. */
  markers: { x: number; y: number }[]
  /**
   * O(1) replacement for SVGPathElement.getPointAtLength().
   * Built from the pre-sampled lookup table in resolveSectorGeometry — ~0.5 SVG-unit
   * resolution with linear interpolation, avoiding the expensive browser geometry query
   * in the 60 fps animation loop.
   */
  pointAtLength: (len: number) => { x: number; y: number }
}

function parseNum(v: WireScalar | undefined): number | null {
  if (v === undefined || v === null || v === "") {
    return null
  }
  const n = typeof v === "number" ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function sectorLengthM(session: Pid0Frame, sector: number): number {
  const key = `S${sector}L` as keyof Pid0Frame
  return parseNum(session[key] as WireScalar) ?? 0
}

function trackLengthMFromSession(session: Pid0Frame | null): number | null {
  if (!session) {
    return null
  }

  const trackLengthM = parseNum(session.TRACKLENGTH)
  if (trackLengthM === null || trackLengthM <= 0) {
    return null
  }
  return trackLengthM
}

export function parseTimingSectorLengths(session: Pid0Frame | null): TimingSectorLengths | null {
  const trackLengthM = trackLengthMFromSession(session)
  if (!session || trackLengthM === null) {
    return null
  }

  const sectorLengthsM = SECTOR_END_POINTS.map((_, i) => sectorLengthM(session, i + 1))
  const sectorSum = sectorLengthsM.reduce((sum, len) => sum + len, 0)
  if (sectorLengthsM.some((len) => len <= 0) || Math.abs(sectorSum - trackLengthM) > 1) {
    return null
  }

  return { trackLengthM, sectorLengthsM }
}

export function equalTimingSectorLengths(trackLengthM: number): TimingSectorLengths | null {
  if (!Number.isFinite(trackLengthM) || trackLengthM <= 0) {
    return null
  }

  return {
    trackLengthM,
    sectorLengthsM: SECTOR_END_POINTS.map(() => trackLengthM / SECTOR_END_POINTS.length),
  }
}

export function resolveTimingSectorLengths(
  session: Pid0Frame | null,
  cached: TimingSectorLengths | null = null,
): TimingSectorLengths | null {
  const parsed = parseTimingSectorLengths(session)
  if (parsed) {
    return parsed
  }

  const trackLengthM = trackLengthMFromSession(session)
  if (cached && (trackLengthM === null || Math.abs(cached.trackLengthM - trackLengthM) <= 1)) {
    return cached
  }

  return trackLengthM === null ? null : equalTimingSectorLengths(trackLengthM)
}

function interpolateSectorSpan(spans: SectorSpan[], progress: number, totalLength: number): number {
  const totalSpanLength = spans.reduce(
    (sum, span) => sum + Math.max(0, span.endLen - span.startLen),
    0,
  )
  if (spans.length === 0 || totalSpanLength <= 0) {
    return 0
  }

  let remaining = Math.max(0, Math.min(1, progress)) * totalSpanLength
  for (const span of spans) {
    const spanLength = Math.max(0, span.endLen - span.startLen)
    if (remaining <= spanLength) {
      return Math.max(0, Math.min(totalLength, span.startLen + remaining))
    }
    remaining -= spanLength
  }

  const last = spans[spans.length - 1]
  return Math.max(0, Math.min(totalLength, last.endLen))
}

export function distanceToPathLength(
  distanceM: number,
  timing: TimingSectorLengths,
  geometry: SectorGeometry,
): number {
  if (geometry.totalLength <= 0 || timing.trackLengthM <= 0) {
    return 0
  }

  const distance = Math.max(0, Math.min(timing.trackLengthM, distanceM))
  if (distance === 0 || distance === timing.trackLengthM) {
    return interpolateSectorSpan(geometry.sectors[0] ?? [], 0, geometry.totalLength)
  }

  let cumulativeM = 0
  for (let i = 0; i < timing.sectorLengthsM.length; i++) {
    const sectorLengthM = timing.sectorLengthsM[i]
    const nextM = cumulativeM + sectorLengthM
    if (distance <= nextM || i === timing.sectorLengthsM.length - 1) {
      const progress = sectorLengthM > 0 ? (distance - cumulativeM) / sectorLengthM : 0
      return interpolateSectorSpan(geometry.sectors[i] ?? [], progress, geometry.totalLength)
    }
    cumulativeM = nextM
  }

  return geometry.totalLength
}

function landmarkBoundaryLengths(path: SVGPathElement, totalLength: number) {
  // Walk the path once at ~0.5-unit resolution.
  // Simultaneously: find sector boundary landmarks AND build a lookup table
  // for O(1) pointAtLength queries in the animation loop.
  const step = 0.5
  const capacity = Math.ceil(totalLength / step) + 2
  const xs = new Float32Array(capacity)
  const ys = new Float32Array(capacity)

  const bestDist = SECTOR_END_POINTS.map(() => Infinity)
  const bestLen = SECTOR_END_POINTS.map(() => 0)
  const markers = SECTOR_END_POINTS.map(() => ({ x: 0, y: 0 }))

  let count = 0
  for (let d = 0; d < totalLength; d += step) {
    const p = path.getPointAtLength(d)
    xs[count] = p.x
    ys[count] = p.y
    count++
    for (let i = 0; i < SECTOR_END_POINTS.length; i++) {
      const dx = p.x - SECTOR_END_POINTS[i].x
      const dy = p.y - SECTOR_END_POINTS[i].y
      const sq = dx * dx + dy * dy
      if (sq < bestDist[i]) {
        bestDist[i] = sq
        bestLen[i] = d
        markers[i] = { x: p.x, y: p.y }
      }
    }
  }

  // Ensure the path end is captured.
  const finish = path.getPointAtLength(totalLength)
  xs[count] = finish.x
  ys[count] = finish.y
  count++

  bestLen[bestLen.length - 1] = totalLength
  markers[markers.length - 1] = { x: finish.x, y: finish.y }

  // Samples are evenly spaced at `step` — direct index + lerp, no binary search.
  const lastIdx = count - 1
  const pointAtLength = (len: number): { x: number; y: number } => {
    if (len <= 0) return { x: xs[0], y: ys[0] }
    if (len >= totalLength) return { x: xs[lastIdx], y: ys[lastIdx] }
    const raw = len / step
    const lo = Math.floor(raw)
    const hi = lo + 1 < lastIdx ? lo + 1 : lastIdx
    const t = raw - lo
    return { x: xs[lo] + (xs[hi] - xs[lo]) * t, y: ys[lo] + (ys[hi] - ys[lo]) * t }
  }

  return { boundaryLengths: bestLen, markers, pointAtLength }
}

export function resolveSectorGeometry(
  path: SVGPathElement,
  session: Pid0Frame | null = null,
): SectorGeometry {
  void session

  const L = path.getTotalLength()
  if (!Number.isFinite(L) || L <= 0) {
    return {
      totalLength: 0,
      sectors: SECTOR_END_POINTS.map(() => []),
      markers: SECTOR_END_POINTS.map(() => ({ x: 0, y: 0 })),
      pointAtLength: () => ({ x: 0, y: 0 }),
    }
  }

  const { boundaryLengths, markers, pointAtLength } = landmarkBoundaryLengths(path, L)

  const sectors: SectorSpan[][] = []
  for (let i = 0; i < boundaryLengths.length; i++) {
    const prev = i === 0 ? boundaryLengths[boundaryLengths.length - 1] : boundaryLengths[i - 1]
    const curr = boundaryLengths[i]
    if (prev <= curr) {
      sectors.push([{ startLen: prev, endLen: curr }])
    } else {
      sectors.push([
        { startLen: prev, endLen: L },
        { startLen: 0, endLen: curr },
      ])
    }
  }

  return { totalLength: L, sectors, markers, pointAtLength }
}
