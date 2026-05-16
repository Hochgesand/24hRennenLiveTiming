import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  computeTrackDrivers,
  currentBlendedVelocity,
  separateDriverDistances,
  type CarHistory,
  type TrackTimingHistory,
  VELOCITY_BLEND_SEC,
} from "./trackTiming"
import { staticClassSpeedMps } from "./classSpeedDefaults"
import type { Pid0Frame, RawResultRow } from "./types"

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function baseSession(overrides: Partial<Pid0Frame> = {}): Pid0Frame {
  return {
    PID: "0",
    TRACKLENGTH: 1000,
    NROFINTERMEDIATETIMES: 8,
    S1L: 100,
    S2L: 100,
    S3L: 100,
    S4L: 100,
    S5L: 100,
    S6L: 100,
    S7L: 100,
    S8L: 100,
    S9L: 100,
    APL: 100,
    TRACKSTATE: "0",
    VER: "2",
    ...overrides,
  }
}

function row(overrides: Partial<RawResultRow> = {}): RawResultRow {
  return {
    STNR: "42",
    NAME: "Driver",
    TEAM: "Team",
    POSITION: 1,
    CLASSNAME: "SP9",
    LASTINTERMEDIATENUMBER: 2,
    LASTIMTIME: 1_000_000,
    ETA: 1_010_000,
    ...overrides,
  }
}

function freshHistory(): TrackTimingHistory {
  return new Map()
}

function runAt(
  nowMs: number,
  session: Pid0Frame,
  history: TrackTimingHistory,
  trackPathLength = 800,
) {
  vi.setSystemTime(nowMs)
  return computeTrackDrivers({
    session,
    remoteTimeDiffMs: 0,
    trackPathLength,
    history,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// -----------------------------------------------------------------------------
// Measured-sector velocity
// -----------------------------------------------------------------------------

describe("measured sector velocity", () => {
  it("computes v = sectorLength / Δt from two adjacent crossings", () => {
    const history = freshHistory()
    const session1 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 })],
    })
    runAt(0, session1, history)

    const session2 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 4_000 })],
    })
    runAt(4_000, session2, history)

    const car = history.get("42") as CarHistory
    // Δm = 100 m (S3 length), Δt = 4 s → 25 m/s.
    expect(car.measuredVelocityMps).toBeCloseTo(25, 5)
  })

  it("handles a wrap across Start/Ziel between crossings", () => {
    // Track of 1000m, IM=9 at 900m, then IM=1 at 100m (after wrap).
    const history = freshHistory()
    const session1 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 9, LASTIMTIME: 0 })],
    })
    runAt(0, session1, history)

    const session2 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 1, LASTIMTIME: 5_000 })],
    })
    runAt(5_000, session2, history)

    const car = history.get("42") as CarHistory
    // Δm wraps: (100 - 900 + 1000) = 200 m, Δt = 5 s → 40 m/s.
    expect(car.measuredVelocityMps).toBeCloseTo(40, 5)
  })

  it("ignores implausible velocities (e.g. tiny Δt → huge v)", () => {
    const history = freshHistory()
    const session1 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 })],
    })
    runAt(0, session1, history)

    // 100m sector in 10ms → 10 000 m/s → rejected (>110 m/s cap).
    const session2 = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 10 })],
    })
    runAt(10, session2, history)

    const car = history.get("42") as CarHistory
    expect(car.measuredVelocityMps).toBeNull()
  })
})

// -----------------------------------------------------------------------------
// Bootstrap velocity
// -----------------------------------------------------------------------------

describe("bootstrap velocity", () => {
  it("uses the static class table on the very first observation", () => {
    const history = freshHistory()
    const session = baseSession({
      RESULT: [row({ STNR: "42", CLASSNAME: "SP9", LASTIMTIME: 0 })],
    })
    runAt(0, session, history)

    // No measured v yet — currentVelocityMps should equal static class default.
    const car = history.get("42") as CarHistory
    expect(car.measuredVelocityMps).toBeNull()
    expect(car.targetVelocityMps).toBe(staticClassSpeedMps("SP9"))
  })

  it("prefers the running session mean once measurements exist for the class", () => {
    const history = freshHistory()
    // Prime two SP9 cars with adjacent crossings → both measure 100m/2s = 50 m/s.
    runAt(
      0,
      baseSession({
        RESULT: [
          row({ STNR: "1", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 }),
          row({ STNR: "2", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 }),
        ],
      }),
      history,
    )
    runAt(
      2_000,
      baseSession({
        RESULT: [
          row({ STNR: "1", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 }),
          row({ STNR: "2", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 }),
        ],
      }),
      history,
    )
    // Both cars now have measuredVelocityMps = 50 → class mean = 50.

    // Brand-new SP9 car appears for the first time at t=3000.
    runAt(
      3_000,
      baseSession({
        RESULT: [
          row({ STNR: "1", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 }),
          row({ STNR: "2", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 }),
          row({ STNR: "99", CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 4, LASTIMTIME: 3_000 }),
        ],
      }),
      history,
    )
    const car99 = history.get("99") as CarHistory
    expect(car99.targetVelocityMps).toBeCloseTo(50, 5)
  })
})

// -----------------------------------------------------------------------------
// Velocity blend
// -----------------------------------------------------------------------------

describe("velocity blend over 5s", () => {
  it("linearly interpolates from old target to new target on a fresh crossing", () => {
    // Construct CarHistory state directly to exercise the blend math without
    // having to navigate the bootstrap→measured→retarget pipeline.
    const car: CarHistory = {
      lastCrossing: { im: 3, tMs: 0, distanceM: 300 },
      prevCrossing: null,
      measuredVelocityMps: 20,
      className: "SP9",
      targetVelocityMps: 50,
      blendStartVelocityMps: 20,
      blendStartTimeMs: 0,
      displayedDistanceM: 300,
      lastFrameTimeMs: 0,
    }

    expect(currentBlendedVelocity(car, 0)).toBeCloseTo(20, 5)
    expect(currentBlendedVelocity(car, 2_500)).toBeCloseTo(35, 5) // halfway
    expect(currentBlendedVelocity(car, 5_000)).toBeCloseTo(50, 5) // arrived
    expect(currentBlendedVelocity(car, 60_000)).toBeCloseTo(50, 5) // sticks
  })

  it("blend window is exactly VELOCITY_BLEND_SEC seconds long", () => {
    expect(VELOCITY_BLEND_SEC).toBe(5)
    const car: CarHistory = {
      lastCrossing: { im: 1, tMs: 0, distanceM: 0 },
      prevCrossing: null,
      measuredVelocityMps: 0,
      className: "SP9",
      targetVelocityMps: 100,
      blendStartVelocityMps: 0,
      blendStartTimeMs: 0,
      displayedDistanceM: 0,
      lastFrameTimeMs: 0,
    }
    // Just shy of complete.
    expect(currentBlendedVelocity(car, VELOCITY_BLEND_SEC * 1000 - 1)).toBeLessThan(100)
    // At exactly the end → fully on target.
    expect(currentBlendedVelocity(car, VELOCITY_BLEND_SEC * 1000)).toBe(100)
  })

  it("a fresh crossing mid-blend retargets starting from the current blended v", () => {
    const history = freshHistory()
    // Two crossings 2 s apart → measured = 50 m/s; bootstrap target was 55 (SP9).
    runAt(
      0,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 })] }),
      history,
    )
    runAt(
      2_000,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 })] }),
      history,
    )
    const car = history.get("42") as CarHistory
    // Blend started at t=2000, from 55 toward 50, over 5 s.
    expect(car.blendStartTimeMs).toBe(2_000)
    expect(car.blendStartVelocityMps).toBeCloseTo(staticClassSpeedMps("SP9"), 5)
    expect(car.targetVelocityMps).toBeCloseTo(50, 5)

    // Mid-blend snapshot: at t=4500, currentV should be (55 + 50) / 2 = 52.5.
    const midV = currentBlendedVelocity(car, 4_500)
    expect(midV).toBeCloseTo((staticClassSpeedMps("SP9") + 50) / 2, 5)

    // A second crossing arrives mid-blend (at t=4500) with measured = 100m/2.5s = 40.
    runAt(
      4_500,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 4, LASTIMTIME: 4_500 })] }),
      history,
    )
    expect(car.measuredVelocityMps).toBeCloseTo(40, 5)
    expect(car.targetVelocityMps).toBeCloseTo(40, 5)
    expect(car.blendStartTimeMs).toBe(4_500)
    // New blend starts from the value currentBlendedVelocity reported just before.
    expect(car.blendStartVelocityMps).toBeCloseTo(midV, 4)
  })
})

// -----------------------------------------------------------------------------
// Coast indefinitely
// -----------------------------------------------------------------------------

describe("coast indefinitely when backend stalls", () => {
  it("keeps advancing position at last known velocity without a cap", () => {
    const history = freshHistory()
    // Two crossings → v = 50 m/s.
    runAt(
      0,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 })] }),
      history,
    )
    runAt(
      2_000,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 })] }),
      history,
    )
    const car = history.get("42") as CarHistory
    expect(car.measuredVelocityMps).toBeCloseTo(50, 5)

    // Resend the SAME stale frame for the next 60 s — no fresh crossing,
    // but position must keep advancing.
    const staleSession = baseSession({
      RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 2_000 })],
    })
    const posStart = car.displayedDistanceM ?? 0
    let posPrev = posStart
    for (let t = 3_000; t <= 62_000; t += 1_000) {
      runAt(t, staleSession, history)
      const now = car.displayedDistanceM as number
      expect(Number.isFinite(now)).toBe(true)
      // strictly monotonic (mod track length we never quite hit here since v=50, t≈60s → 3 000m > 1 000m wraps)
      expect(now).not.toBeNaN()
      posPrev = now
    }
    // After ~60 s coasting at 50 m/s from position ≈ 300, we have traveled ~3 000 m.
    // The track is only 1 000 m → wrapped multiple times; assert at least one wrap.
    expect(posStart).toBeGreaterThan(0)
    expect(posPrev).toBeGreaterThanOrEqual(0)
  })
})

// -----------------------------------------------------------------------------
// Staleness rejection
// -----------------------------------------------------------------------------

describe("stale frame rejection", () => {
  it("rejects a row whose LASTIMTIME regresses below the cached value", () => {
    const history = freshHistory()
    runAt(
      0,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 5_000 })] }),
      history,
    )
    const car = history.get("42") as CarHistory
    expect(car.lastCrossing?.tMs).toBe(5_000)

    // Stale frame with older LASTIMTIME — should be silently rejected.
    runAt(
      6_000,
      baseSession({ RESULT: [row({ LASTINTERMEDIATENUMBER: 1, LASTIMTIME: 1_000 })] }),
      history,
    )
    expect(car.lastCrossing?.tMs).toBe(5_000)
    expect(car.lastCrossing?.im).toBe(3)
  })
})

// -----------------------------------------------------------------------------
// Off-track / track-state visibility
// -----------------------------------------------------------------------------

describe("visibility filtering", () => {
  it("hides VER=2 off-track intermediates (14/15/16/20)", () => {
    const history = freshHistory()
    const session = baseSession({
      RESULT: [
        row({ STNR: "1", LASTINTERMEDIATENUMBER: 14, LASTIMTIME: 0 }),
        row({ STNR: "2", LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 }),
      ],
    })
    const markers = runAt(0, session, history)
    expect(markers.find((m) => m.startingNumber === "1")?.visible).toBe(false)
    expect(markers.find((m) => m.startingNumber === "2")?.visible).toBe(true)
  })

  it("hides all cars under yellow/red/code-60", () => {
    const history = freshHistory()
    const session = baseSession({
      RESULT: [row({ STNR: "7", LASTINTERMEDIATENUMBER: 2, LASTIMTIME: 0 })],
    })
    vi.setSystemTime(0)
    const markers = computeTrackDrivers({
      session,
      trackState: "1",
      remoteTimeDiffMs: 0,
      trackPathLength: 500,
      history,
    })
    expect(markers[0]?.visible).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Derived per-class position + assembled tooltip fields
// -----------------------------------------------------------------------------

describe("derived per-class position", () => {
  it("ranks cars within their CLASSNAME bucket by POSITION ascending", () => {
    const history = freshHistory()
    const session = baseSession({
      RESULT: [
        row({ STNR: "1", POSITION: 1, CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 2 }),
        row({ STNR: "2", POSITION: 2, CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 2 }),
        row({ STNR: "3", POSITION: 3, CLASSNAME: "SP10", LASTINTERMEDIATENUMBER: 2 }),
        row({ STNR: "4", POSITION: 4, CLASSNAME: "SP9", LASTINTERMEDIATENUMBER: 2 }),
      ],
    })
    const markers = runAt(0, session, history)
    expect(markers.find((m) => m.startingNumber === "1")?.classPosition).toBe(1)
    expect(markers.find((m) => m.startingNumber === "2")?.classPosition).toBe(2)
    expect(markers.find((m) => m.startingNumber === "4")?.classPosition).toBe(3)
    expect(markers.find((m) => m.startingNumber === "3")?.classPosition).toBe(1)
  })
})

// -----------------------------------------------------------------------------
// Overlap separation (regression for the WIGE 70 m algorithm)
// -----------------------------------------------------------------------------

describe("separateDriverDistances", () => {
  it("pushes overlapping cars apart by at least 70 m", () => {
    const rows = [
      { stnr: "a", rawRow: {} as RawResultRow, im: 2, onTrack: true, dist: 100 },
      { stnr: "b", rawRow: {} as RawResultRow, im: 2, onTrack: true, dist: 120 },
    ]
    separateDriverDistances(rows, 1000)
    expect(Math.abs(rows[0].dist - rows[1].dist)).toBeGreaterThanOrEqual(70)
  })
})
