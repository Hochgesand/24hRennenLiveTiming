import { afterEach, describe, expect, it, vi } from "vitest"

import type { Pid0Frame, RawResultRow } from "./types"
import {
  calculateRowDistanceM,
  computeRowTimingProjection,
  computeTrackDrivers,
  separateDriverDistances,
  type TrackDriverHistory,
} from "./trackPositions"

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
    CLASSNAME: "SP 9",
    LASTINTERMEDIATENUMBER: 2,
    LASTIMTIME: 1_000_000,
    ETA: 1_010_000,
    ...overrides,
  }
}

describe("calculateRowDistanceM — ETA as predicted finish-line time", () => {
  // baseSession: TRACKLENGTH=1000, S1L..S9L=100 each.
  // IM=2 → lastDist=200, nextBound=300.

  it("interpolates at the midpoint of the proportional current-sector window", () => {
    const session = baseSession()
    // ETA−LASTIMTIME = 10 s, remainingM = 800 m.
    // currentSectorSec = 10 * (100/800) = 1.25 s.
    // At 0.625 s elapsed: progress = 0.5 → dist = 200 + 50 = 250.
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 0,
      ETA: 10_000,
    })
    const dist = calculateRowDistanceM(session, r, 625)
    expect(dist).toBe(250)
  })

  it("extrapolates past nextBound when elapsed exceeds sector time budget", () => {
    const session = baseSession()
    // currentSectorSec ≈ 1.25 s, velocity ≈ 80 m/s; at 5 s → projected ≈ 600, cap = 400.
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 0,
      ETA: 10_000,
    })
    const dist = calculateRowDistanceM(session, r, 5_000)
    expect(dist).toBe(400) // nextBound=300 + currentSectorM=100
  })

  it("falls back to the last known intermediate when segment duration is zero", () => {
    const session = baseSession()
    const r = row({ LASTIMTIME: 100, ETA: 100 })
    expect(calculateRowDistanceM(session, r, 200)).toBe(200)
  })

  it("falls back to the last known intermediate when timing fields are missing", () => {
    const session = baseSession()
    const r = row({ ETA: undefined })
    expect(calculateRowDistanceM(session, r, 200)).toBe(200)
  })

  it("does not interpolate backwards — negative elapsed is clamped to zero", () => {
    const session = baseSession()
    const r = row({ LASTIMTIME: 10_000, ETA: 20_000 })
    // timeOfDayMs < LASTIMTIME → elapsedSec < 0 → clamped to 0 → dist = lastDist
    expect(calculateRowDistanceM(session, r, 0)).toBe(200)
  })

  it("sector-length weighting: current-sector time scales with its fraction of remainingM", () => {
    // Nürburgring-like sizes: S4=696m (small), S5=5306m (large).
    const session = baseSession({
      TRACKLENGTH: 25378,
      NROFINTERMEDIATETIMES: 8,
      S1L: 1796,
      S2L: 1968,
      S3L: 3076,
      S4L: 696,
      S5L: 5306,
      S6L: 2042,
      S7L: 7297,
      S8L: 1428,
      S9L: 1769,
    })
    // IM=4 → lastDist = S1+S2+S3+S4 = 7536, nextBound = 7536+5306 = 12842.
    // remainingM = 25378−7536 = 17842.
    // Choose remainingSec so that currentSectorSec = 100 s exactly:
    //   currentSectorSec = remainingSec * (5306/17842) = 100
    //   → remainingSec = 100 * 17842/5306 ≈ 336.24 s → ETA−LASTIMTIME = 336240 ms.
    const remainingSec = (100 * 17842) / 5306
    const etaMinusLast = Math.round(remainingSec * 1000)
    const r = row({
      LASTINTERMEDIATENUMBER: 4,
      LASTIMTIME: 0,
      ETA: etaMinusLast,
    })
    // At 50 s elapsed: progress = 0.5 → dist ≈ 7536 + 5306*0.5 = 10189.
    const dist = calculateRowDistanceM(session, r, 50_000)
    expect(dist).toBeGreaterThan(7536 + 5306 * 0.45)
    expect(dist).toBeLessThan(7536 + 5306 * 0.55)
  })

  it("diagnosis case #569 — IM=6, ETA−LASTIMTIME=624s gives sensible speed", () => {
    // S1+S2+S3+S4+S5+S6 = 1796+1968+3076+696+5306+2042 = 14884 m.
    // remainingM = 25378−14884 = 10494 m (matches the "10 494 m" in the diagnosis).
    // At finish-line pace: 10494/624 ≈ 16.8 m/s ≈ 60 km/h — sensible.
    // nextBound = 14884+7297 = 22181.
    const session = baseSession({
      TRACKLENGTH: 25378,
      NROFINTERMEDIATETIMES: 8,
      S1L: 1796,
      S2L: 1968,
      S3L: 3076,
      S4L: 696,
      S5L: 5306,
      S6L: 2042,
      S7L: 7297,
      S8L: 1428,
      S9L: 1769,
    })
    const r = row({
      LASTINTERMEDIATENUMBER: 6,
      LASTIMTIME: 0,
      ETA: 624_000,
    })
    // At t=0 (just crossed IM6): progress=0 → lastDist=14884.
    const dist0 = calculateRowDistanceM(session, r, 0)
    expect(dist0).toBe(14884)

    // At t=100s, should have moved forward but not past sector S7 end.
    const dist100 = calculateRowDistanceM(session, r, 100_000)
    expect(dist100).toBeGreaterThan(14884)
    expect(dist100).toBeLessThanOrEqual(22181)
  })

  it("keeps cumulative distances across VER=2 intermediates when elapsed=0", () => {
    const session = baseSession({
      TRACKLENGTH: 4500,
      NROFINTERMEDIATETIMES: 9,
      S1L: 100,
      S2L: 200,
      S3L: 300,
      S4L: 400,
      S5L: 500,
      S6L: 600,
      S7L: 700,
      S8L: 800,
      S9L: 900,
    })

    // At elapsed=0 progress=0 → returns lastDist for each IM.
    expect(
      calculateRowDistanceM(
        session,
        row({ LASTINTERMEDIATENUMBER: 3, LASTIMTIME: 0, ETA: 10_000 }),
        0,
      ),
    ).toBe(600)
    expect(
      calculateRowDistanceM(
        session,
        row({ LASTINTERMEDIATENUMBER: 4, LASTIMTIME: 0, ETA: 10_000 }),
        0,
      ),
    ).toBe(1000)
    expect(
      calculateRowDistanceM(
        session,
        row({ LASTINTERMEDIATENUMBER: 5, LASTIMTIME: 0, ETA: 10_000 }),
        0,
      ),
    ).toBe(1500)
    expect(
      calculateRowDistanceM(
        session,
        row({ LASTINTERMEDIATENUMBER: 6, LASTIMTIME: 0, ETA: 10_000 }),
        0,
      ),
    ).toBe(2100)
    expect(
      calculateRowDistanceM(
        session,
        row({ LASTINTERMEDIATENUMBER: 7, LASTIMTIME: 0, ETA: 10_000 }),
        0,
      ),
    ).toBe(2800)
  })

  it("extrapolates past nextBound when elapsedSec exceeds proportional sector budget", () => {
    const session = baseSession({
      TRACKLENGTH: 4500,
      NROFINTERMEDIATETIMES: 9,
      S1L: 100,
      S2L: 200,
      S3L: 300,
      S4L: 400,
      S5L: 500,
      S6L: 600,
      S7L: 700,
      S8L: 800,
      S9L: 900,
    })

    // IM=6: lastDist=2100, nextBound=2800, currentSectorM=700.
    // currentSectorSec ≈ 2.917 s; at 5 s projected ≈ 3300 (past nextBound, under cap).
    const dist = calculateRowDistanceM(
      session,
      row({ LASTINTERMEDIATENUMBER: 6, LASTIMTIME: 0, ETA: 10_000 }),
      5_000,
    )
    expect(dist).toBe(3300)
  })

  it("extrapolates past predicted boundary at constant velocity", () => {
    const session = baseSession()
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 0,
      ETA: 10_000,
    })
    // currentSectorSec = 1.25 s, velocity = 80 m/s; at 2 s → 360 m (past nextBound=300).
    const dist = calculateRowDistanceM(session, r, 2_000)
    expect(dist).toBe(360)
  })

  it("caps extrapolation at one sector beyond predicted boundary", () => {
    const session = baseSession()
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 0,
      ETA: 10_000,
    })
    // Very large elapsed → hits lookaheadCap = nextBound + currentSectorM = 400.
    const dist = calculateRowDistanceM(session, r, 60_000)
    expect(dist).toBe(400)
  })

  it("no regression on fresh update after extrapolation", () => {
    const session = baseSession()
    const extrapolated = calculateRowDistanceM(
      session,
      row({
        LASTINTERMEDIATENUMBER: 2,
        LASTIMTIME: 0,
        ETA: 10_000,
      }),
      2_000,
    )
    expect(extrapolated).toBeGreaterThan(300) // past nextBound

    // New intermediate at IM=3: lastDist=300, elapsed=0 → snaps to anchor.
    const fresh = calculateRowDistanceM(
      session,
      row({
        LASTINTERMEDIATENUMBER: 3,
        LASTIMTIME: 2_000,
        ETA: 12_000,
      }),
      2_000,
    )
    expect(fresh).toBe(300)
  })
})

describe("computeRowTimingProjection — anchor fields", () => {
  it("exposes anchor, server time, and predicted velocity for the current sector", () => {
    const session = baseSession()
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 1_000,
      ETA: 11_000,
    })
    const projection = computeRowTimingProjection(session, r, 1_000)
    expect(projection.anchorDistanceM).toBe(200)
    expect(projection.anchorTimeMs).toBe(1_000)
    // currentSectorSec = 10 * (100/800) = 1.25 s → velocity = 80 m/s
    expect(projection.predictedVelocityMps).toBeCloseTo(80, 5)
    expect(projection.maxProjectedDistanceM).toBe(400) // nextBound=300 + sector=100
    expect(projection.currentDistanceM).toBe(200) // elapsed=0
  })
})

describe("computeTrackDrivers — marker timing fields", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("plumbs anchor fields and track length onto each marker", () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000)

    const session = baseSession({
      RESULT: [
        row({
          STNR: "42",
          LASTINTERMEDIATENUMBER: 2,
          LASTIMTIME: 1_000,
          ETA: 11_000,
        }),
      ],
    })
    const markers = computeTrackDrivers({
      session,
      remoteTimeDiffMs: 0,
      trackPathLength: 800,
    })
    const m = markers[0]
    expect(m?.anchorDistanceM).toBe(200)
    expect(m?.anchorTimeMs).toBe(1_000)
    expect(m?.predictedVelocityMps).toBeCloseTo(80, 5)
    expect(m?.trackLengthM).toBe(1000)
    expect(m?.maxProjectedDistanceM).toBe(400)
  })
})

describe("computeTrackDrivers — staleness guard", () => {
  it("rejects a stale row whose LASTIMTIME regresses", () => {
    const session = baseSession({
      TRACKLENGTH: 1000,
      RESULT: [
        row({
          STNR: "42",
          LASTINTERMEDIATENUMBER: 3,
          LASTIMTIME: 5_000,
          ETA: 30_000,
        }),
      ],
    })
    const history: TrackDriverHistory = new Map()

    // First call: primes the cache with IM=3, LASTIMTIME=5000.
    const fresh = computeTrackDrivers({
      session,
      remoteTimeDiffMs: 0,
      trackPathLength: 800,
      history,
    })
    const freshDist = fresh[0]?.distanceM ?? 0

    // Second call: stale row has LASTIMTIME=1000 < 5000 → should be rejected.
    const staleSession = baseSession({
      TRACKLENGTH: 1000,
      RESULT: [
        row({
          STNR: "42",
          LASTINTERMEDIATENUMBER: 1,
          LASTIMTIME: 1_000,
          ETA: 20_000,
        }),
      ],
    })
    const stale = computeTrackDrivers({
      session: staleSession,
      remoteTimeDiffMs: 0,
      trackPathLength: 800,
      history,
    })
    // Distance must not regress below the fresh result's last-intermediate.
    expect(stale[0]?.distanceM).toBeGreaterThanOrEqual(freshDist)
  })

  it("accepts a fresher row and advances position", () => {
    const session = baseSession({
      TRACKLENGTH: 1000,
      RESULT: [
        row({
          STNR: "42",
          LASTINTERMEDIATENUMBER: 2,
          LASTIMTIME: 3_000,
          ETA: 30_000,
        }),
      ],
    })
    const history: TrackDriverHistory = new Map()

    computeTrackDrivers({ session, remoteTimeDiffMs: 0, trackPathLength: 800, history })

    const fresherSession = baseSession({
      TRACKLENGTH: 1000,
      RESULT: [
        row({
          STNR: "42",
          LASTINTERMEDIATENUMBER: 3,
          LASTIMTIME: 10_000,
          ETA: 30_000,
        }),
      ],
    })
    const markers = computeTrackDrivers({
      session: fresherSession,
      remoteTimeDiffMs: 0,
      trackPathLength: 800,
      history,
    })
    // IM=3 → lastDist=300 ≥ IM=2 lastDist=200.
    expect(markers[0]?.distanceM).toBeGreaterThanOrEqual(300)
  })

  it("returns empty when session or track length missing", () => {
    expect(
      computeTrackDrivers({
        session: null,
        remoteTimeDiffMs: 0,
        trackPathLength: 100,
      }),
    ).toEqual([])
    expect(
      computeTrackDrivers({
        session: baseSession({ TRACKLENGTH: undefined }),
        remoteTimeDiffMs: 0,
        trackPathLength: 100,
      }),
    ).toEqual([])
  })

  it("marks VER=2 pit/off-track intermediates as not visible", () => {
    const session = baseSession({
      RESULT: [
        row({ STNR: "1", LASTINTERMEDIATENUMBER: 14 }),
        row({ STNR: "2", LASTINTERMEDIATENUMBER: 2 }),
      ],
    })
    const markers = computeTrackDrivers({
      session,
      remoteTimeDiffMs: 0,
      trackPathLength: 500,
    })
    expect(markers.find((m) => m.startingNumber === "1")?.visible).toBe(false)
    expect(markers.find((m) => m.startingNumber === "2")?.visible).toBe(true)
  })

  it("keeps VER=2 intermediates 8 and 9 visible on track", () => {
    const session = baseSession({
      RESULT: [
        row({ STNR: "8", LASTINTERMEDIATENUMBER: 8 }),
        row({ STNR: "9", LASTINTERMEDIATENUMBER: 9 }),
      ],
    })
    const markers = computeTrackDrivers({
      session,
      remoteTimeDiffMs: 0,
      trackPathLength: 500,
    })
    expect(markers.find((m) => m.startingNumber === "8")?.visible).toBe(true)
    expect(markers.find((m) => m.startingNumber === "9")?.visible).toBe(true)
  })

  it("hides all cars when track state is yellow/red", () => {
    const session = baseSession({
      RESULT: [row({ STNR: "7" })],
    })
    const markers = computeTrackDrivers({
      session,
      trackState: "1",
      remoteTimeDiffMs: 0,
      trackPathLength: 500,
    })
    expect(markers[0]?.visible).toBe(false)
    expect(markers[0]?.distanceM).toBe(0)
  })

  it("maps distance to path fraction", () => {
    const session = baseSession({
      RESULT: [
        row({
          STNR: "99",
          LASTINTERMEDIATENUMBER: 1,
          LASTIMTIME: 0,
          ETA: 20_000,
        }),
      ],
    })
    const markers = computeTrackDrivers({
      session,
      remoteTimeDiffMs: 0,
      trackPathLength: 800,
    })
    const m = markers[0]
    expect(m?.visible).toBe(true)
    expect(m?.pathFraction).toBeGreaterThan(0)
    expect(m?.pathFraction).toBeLessThanOrEqual(1)
  })
})

describe("separateDriverDistances", () => {
  it("pushes overlapping cars apart by at least 70m", () => {
    const rows: Parameters<typeof separateDriverDistances>[0] = [
      { DIST: 100, ONTRACK: true },
      { DIST: 120, ONTRACK: true },
    ]
    separateDriverDistances(rows, 1000)
    expect(Math.abs(rows[0].DIST - rows[1].DIST)).toBeGreaterThanOrEqual(70)
  })
})
