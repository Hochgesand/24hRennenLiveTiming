import { describe, expect, it } from "vitest"

import type { Pid0Frame, RawResultRow } from "./types"
import {
  calculateRowDistanceM,
  computeTrackDrivers,
  separateDriverDistances,
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

describe("calculateRowDistanceM", () => {
  it("interpolates between last intermediate and ETA", () => {
    const session = baseSession()
    const r = row({
      LASTINTERMEDIATENUMBER: 2,
      LASTIMTIME: 0,
      ETA: 10_000,
    })
    const dist = calculateRowDistanceM(session, r, 5_000)
    expect(dist).toBe(250)
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

  it("does not interpolate backwards before the last intermediate time", () => {
    const session = baseSession()
    const r = row({ LASTIMTIME: 10_000, ETA: 20_000 })
    expect(calculateRowDistanceM(session, r, 0)).toBe(200)
  })

  it("keeps cumulative distances across VER=2 intermediates 3 through 7", () => {
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

  it("interpolates inside the current high intermediate segment", () => {
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

    const dist = calculateRowDistanceM(
      session,
      row({ LASTINTERMEDIATENUMBER: 6, LASTIMTIME: 0, ETA: 10_000 }),
      5_000,
    )

    expect(dist).toBe(2450)
  })
})

describe("computeTrackDrivers", () => {
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
