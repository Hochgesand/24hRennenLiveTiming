/**
 * Fixture regression test — track-map smoothness.
 *
 * Replays the captured PID 0 frames from `trackmap.event50.json` (event 50,
 * Nürburgring 24h 2026) through the rewritten `computeTrackDrivers`, and
 * asserts that the rendered SVG-unit motion between consecutive ≤2 s samples
 * never produces an outlier "jump".
 *
 * The pure-velocity-integration model bounds inter-frame motion at
 * `v_max * dt ≤ 110 m/s * 2 s = 220 m`. On a 25 378 m track mapped to a
 * 2 019-unit SVG path, that caps inter-frame motion at ~17.5 SVG units —
 * an order of magnitude tighter than the pre-fix baseline (~199 jumps >40).
 *
 * The first observation for each car (bootstrap snap to anchor) is naturally
 * excluded by the `prev` guard in the loop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { computeTrackDrivers, type TrackTimingHistory } from "../trackTiming"
import type { Pid0Frame, RawResultRow } from "../types"
import rawFixture from "./trackmap.event50.json"

type FixtureSample = {
  at: number
  remoteTimeDiffMs: number
  trackState: string
  rows: Array<{
    STNR: string
    LASTINTERMEDIATENUMBER: string | number
    LASTIMTIME: string | number
    ETA: string | number
  }>
}

type Fixture = {
  session: Pid0Frame
  pathLength: number
  samples: FixtureSample[]
}

const fixture = rawFixture as unknown as Fixture

describe("trackTiming fixture — captured event-50 frames", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("yields zero inter-frame SVG jumps > 40 units (pre-fix baseline: ~199)", () => {
    const { session, pathLength, samples } = fixture
    const trackLength = Number(session.TRACKLENGTH)
    expect(trackLength).toBeGreaterThan(0)
    expect(pathLength).toBeGreaterThan(0)

    let jumpCount = 0
    const prevPathLen = new Map<string, { len: number; at: number }>()
    const history: TrackTimingHistory = new Map()

    for (const sample of samples) {
      const { at, remoteTimeDiffMs, trackState, rows } = sample
      vi.mocked(Date.now).mockReturnValue(at)

      const pid0: Pid0Frame = {
        ...session,
        TRACKSTATE: trackState,
        RESULT: rows as RawResultRow[],
      }

      const markers = computeTrackDrivers({
        session: pid0,
        trackState,
        remoteTimeDiffMs,
        trackPathLength: pathLength,
        history,
      })

      for (const marker of markers) {
        if (!marker.visible) {
          prevPathLen.delete(marker.startingNumber)
          continue
        }
        const svgLen = marker.pathFraction * pathLength
        const prev = prevPathLen.get(marker.startingNumber)
        if (prev) {
          const dt = (at - prev.at) / 1000
          // Use wrap-aware delta so seam crossings don't false-positive.
          let raw = Math.abs(svgLen - prev.len)
          if (raw > pathLength / 2) raw = pathLength - raw
          if (dt <= 2 && raw > 40) {
            jumpCount++
          }
        }
        prevPathLen.set(marker.startingNumber, { len: svgLen, at })
      }
    }

    expect(jumpCount).toBe(0)
  })
})
