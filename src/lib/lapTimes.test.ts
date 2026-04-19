import { describe, expect, it } from "vitest"

import type { LapChartPoint } from "./lapTimes"
import {
  formatLapSeconds,
  lapSeriesFromPayload,
  lastNLapsAverageSeconds,
  parseLapTimeToSeconds,
  personalBestSeconds,
  resolveAverageSeconds,
  stintAverageSeconds,
} from "./lapTimes"

describe("parseLapTimeToSeconds", () => {
  it("parses seconds-only", () => {
    expect(parseLapTimeToSeconds("86.945")).toBeCloseTo(86.945, 3)
  })
  it("parses m:ss.xxx", () => {
    expect(parseLapTimeToSeconds("1:26.945")).toBeCloseTo(86.945, 3)
  })
  it("parses h:mm:ss", () => {
    expect(parseLapTimeToSeconds("0:1:26.945")).toBeCloseTo(86.945, 3)
  })
  it("returns null for empty", () => {
    expect(parseLapTimeToSeconds("")).toBeNull()
    expect(parseLapTimeToSeconds("-")).toBeNull()
  })
})

describe("lapSeriesFromPayload", () => {
  it("sorts by lap and drops invalid times", () => {
    const payload = {
      DATA: [
        { L: 3, T: "1:30.000" },
        { L: 1, T: "1:31.000" },
        { L: 2, T: "" },
        { L: 2, T: "1:29.500" },
      ],
    }
    const s = lapSeriesFromPayload(payload)
    expect(s).not.toBeNull()
    if (s === null) {
      throw new Error("expected series")
    }
    expect(s.map((p) => p.lap)).toEqual([1, 2, 3])
    expect(s[0]!.seconds).toBeCloseTo(91, 3)
    expect(s[1]!.seconds).toBeCloseTo(89.5, 3)
  })

  it("accepts top-level lap array", () => {
    const s = lapSeriesFromPayload([{ L: 1, T: "86.945" }])
    expect(s).not.toBeNull()
    if (s === null) {
      throw new Error("expected series")
    }
    expect(s[0]!.seconds).toBeCloseTo(86.945, 3)
  })

  it("returns null for unrecognized shape", () => {
    expect(lapSeriesFromPayload({ notLaps: [] })).toBeNull()
    expect(lapSeriesFromPayload(null)).toBeNull()
  })
})

describe("aggregates", () => {
  const pts: LapChartPoint[] = [
    { lap: 1, seconds: 100, lapTimeLabel: "100" },
    { lap: 2, seconds: 90, lapTimeLabel: "90" },
    { lap: 3, seconds: 95, lapTimeLabel: "95" },
  ]
  const six = [
    { lap: 1, seconds: 10, lapTimeLabel: "10" },
    { lap: 2, seconds: 20, lapTimeLabel: "20" },
    { lap: 3, seconds: 30, lapTimeLabel: "30" },
    { lap: 4, seconds: 40, lapTimeLabel: "40" },
    { lap: 5, seconds: 50, lapTimeLabel: "50" },
    { lap: 6, seconds: 60, lapTimeLabel: "60" },
  ]
  it("personal best", () => {
    expect(personalBestSeconds(pts)).toBe(90)
  })
  it("stint average", () => {
    expect(stintAverageSeconds(pts)).toBeCloseTo(95, 5)
  })
  it("last N", () => {
    expect(lastNLapsAverageSeconds(pts, 2)).toBeCloseTo(92.5, 5)
  })
  it("resolveAverageSeconds", () => {
    expect(resolveAverageSeconds(pts, "off")).toBeNull()
    expect(resolveAverageSeconds(pts, "stint")).toBeCloseTo(95, 5)
    expect(resolveAverageSeconds(six, "last5")).toBeCloseTo(40, 5)
  })
})

describe("formatLapSeconds", () => {
  it("formats under 60s", () => {
    expect(formatLapSeconds(59.123)).toMatch(/59\.123/)
  })
  it("formats minutes", () => {
    expect(formatLapSeconds(125.5)).toBe("2:05.500")
  })
})
