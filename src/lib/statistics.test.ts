import { describe, expect, it } from "vitest"

import { classKpis } from "@/lib/statistics"
import type { Pid9002Frame } from "@/lib/types"

function frame(
  partial: Partial<Pid9002Frame>
): Pid9002Frame {
  return {
    PID: "9002",
    ...partial,
  } as Pid9002Frame
}

describe("classKpis", () => {
  it("returns zeroed defaults for null / undefined / empty input", () => {
    const empty = {
      fastestLap: null,
      theoreticalBestSeconds: null,
      deltaSeconds: null,
      activeClasses: 0,
      leadingCount: 0,
    }

    expect(classKpis(null)).toEqual(empty)
    expect(classKpis(undefined)).toEqual(empty)
    expect(classKpis(frame({}))).toEqual(empty)
    expect(
      classKpis(frame({ BESTLAPS: [], BESTSECTORS: [], LEADING: [] }))
    ).toEqual(empty)
  })

  it("picks the smallest parseable lap time and exposes its class + carNumber", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
        { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
        { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
      ],
    })

    const result = classKpis(stats)
    expect(result.fastestLap).not.toBeNull()
    expect(result.fastestLap?.seconds).toBeCloseTo(474.218, 3)
    expect(result.fastestLap?.display).toBe("7:54.218")
    expect(result.fastestLap?.classLabel).toBe("SP-Pro")
    expect(result.fastestLap?.carNumber).toBe("911")
  })

  it("ignores unparseable LAPTIME values when picking the fastest", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "DNF" },
        { CLASS: "SP9", NR: "200", LAPTIME: "" },
        { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
        { CLASS: "Cup3", NR: "55", LAPTIME: "—" },
      ],
    })

    const result = classKpis(stats)
    expect(result.fastestLap?.seconds).toBeCloseTo(474.218, 3)
    expect(result.fastestLap?.carNumber).toBe("911")
  })

  it("falls back to em-dash for missing class / car number on the fastest row", () => {
    const stats = frame({
      BESTLAPS: [{ LAPTIME: "7:54.218" }],
    })

    const result = classKpis(stats)
    expect(result.fastestLap?.classLabel).toBe("—")
    expect(result.fastestLap?.carNumber).toBe("—")
  })

  it("sums S1..Sn from the TOTAL row to derive theoreticalBestSeconds", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "2:31.500", S2: "2:36.300", S3: "2:47.000" },
        {
          CLASS: "TOTAL",
          S1: "2:30.100",
          S2: "2:35.200",
          S3: "2:46.102",
        },
      ],
    })

    const result = classKpis(stats)
    expect(result.theoreticalBestSeconds).toBeCloseTo(471.402, 3)
  })

  it("returns null theoreticalBestSeconds if only one sector is parseable", () => {
    const stats = frame({
      BESTSECTORS: [{ CLASS: "TOTAL", S1: "2:30.100" }],
    })

    expect(classKpis(stats).theoreticalBestSeconds).toBeNull()
  })

  it("returns null theoreticalBestSeconds when no TOTAL row exists", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "2:30.100", S2: "2:35.200", S3: "2:46.102" },
      ],
    })

    expect(classKpis(stats).theoreticalBestSeconds).toBeNull()
  })

  it("counts distinct active classes (excluding TOTAL, ignoring empty / null)", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "SP9" },
        { CLASS: "SP9" },
        { CLASS: "SP-Pro" },
        { CLASS: "TOTAL" },
        { CLASS: "Cup3" },
        { CLASS: null },
        { CLASS: "" },
      ],
    })

    const result = classKpis(stats)
    expect(result.activeClasses).toBe(3)
    expect(result.leadingCount).toBe(7)
  })

  it("treats TOTAL case-insensitively when counting active classes", () => {
    const stats = frame({
      LEADING: [{ CLASS: "total" }, { CLASS: "Total" }, { CLASS: "SP9" }],
    })

    expect(classKpis(stats).activeClasses).toBe(1)
  })

  it("computes deltaSeconds = fastestLap.seconds - theoreticalBestSeconds", () => {
    const stats = frame({
      BESTLAPS: [{ CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" }],
      BESTSECTORS: [
        {
          CLASS: "TOTAL",
          S1: "2:30.100",
          S2: "2:35.200",
          S3: "2:46.102",
        },
      ],
    })

    const result = classKpis(stats)
    expect(result.fastestLap?.seconds).toBeCloseTo(474.218, 3)
    expect(result.theoreticalBestSeconds).toBeCloseTo(471.402, 3)
    expect(result.deltaSeconds).toBeCloseTo(
      (result.fastestLap?.seconds ?? 0) - (result.theoreticalBestSeconds ?? 0),
      6
    )
    expect(result.deltaSeconds).toBeCloseTo(2.816, 3)
  })

  it("yields null deltaSeconds when either side is missing", () => {
    const onlyLap = frame({
      BESTLAPS: [{ LAPTIME: "7:54.218" }],
    })
    const onlySectors = frame({
      BESTSECTORS: [{ CLASS: "TOTAL", S1: "2:00.000", S2: "2:00.000" }],
    })

    expect(classKpis(onlyLap).deltaSeconds).toBeNull()
    expect(classKpis(onlySectors).deltaSeconds).toBeNull()
  })
})
