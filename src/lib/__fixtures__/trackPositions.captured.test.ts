/**
 * Fixture regression test — track-map jump count.
 *
 * Replays the curated PID 0 frames from `trackmap.event50.json` (captured
 * live from event 50, Nürburgring 24h 2026) through `computeTrackDrivers`
 * and asserts that the number of per-car SVG-unit jumps > 40 between
 * consecutive ≤2 s samples drops to ≤ 5 (baseline without fix: ~199).
 *
 * The test mocks `Date.now()` per sample so that elapsed-time calculations
 * use the original capture timestamps rather than the current wall clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { computeTrackDrivers, type TrackDriverHistory } from "../trackPositions"
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

describe("trackPositions fixture — captured event-50 frames", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("jumps >40 SVG units between consecutive samples drops to ≤5 after fix", () => {
    const { session, pathLength, samples } = fixture
    const trackLength = Number(session.TRACKLENGTH)
    expect(trackLength).toBeGreaterThan(0)
    expect(pathLength).toBeGreaterThan(0)

    let jumpCount = 0
    const prevPathLen = new Map<string, { len: number; at: number }>()
    const history: TrackDriverHistory = new Map()

    for (const sample of samples) {
      const { at, remoteTimeDiffMs, trackState, rows } = sample

      // Make computeTrackDrivers see the original capture time as "now".
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
        // 2019 SVG units for the whole lap (from static geometry).
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
          const delta = Math.abs(svgLen - prev.len)
          if (dt <= 2 && delta > 40) {
            jumpCount++
          }
        }
        prevPathLen.set(marker.startingNumber, { len: svgLen, at })
      }
    }

    // Baseline (before ETA math fix): ~199 jumps.
    // After fix: 0 measured; allow ≤5 for any rounding edge-cases.
    expect(jumpCount).toBeLessThanOrEqual(5)
  })
})
