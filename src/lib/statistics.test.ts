import { describe, expect, it } from "vitest"

import {
  availableStatClasses,
  bestLapsByClass,
  classKpis,
  filterRowsByExcludedClasses,
  formatDeltaSeconds,
  isStatsClassExcluded,
} from "@/lib/statistics"
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

describe("availableStatClasses", () => {
  it("returns an empty array for null / undefined / empty input", () => {
    expect(availableStatClasses(null)).toEqual([])
    expect(availableStatClasses(undefined)).toEqual([])
    expect(availableStatClasses(frame({}))).toEqual([])
    expect(
      availableStatClasses(
        frame({ LEADING: [], BESTLAPS: [], BESTSECTORS: [] })
      )
    ).toEqual([])
  })

  it("dedupes overlapping classes across LEADING, BESTLAPS, and BESTSECTORS", () => {
    const stats = frame({
      LEADING: [{ CLASS: "SP9" }, { CLASS: "SP-Pro" }],
      BESTLAPS: [{ CLASS: "SP9", LAPTIME: "7:54.218" }, { CLASS: "Cup3" }],
      BESTSECTORS: [{ CLASS: "SP-Pro" }, { CLASS: "Cup3" }, { CLASS: "V6" }],
    })

    expect(availableStatClasses(stats)).toEqual(["Cup3", "SP-Pro", "SP9", "V6"])
  })

  it("skips TOTAL rows case-insensitively across all three arrays", () => {
    const stats = frame({
      LEADING: [{ CLASS: "TOTAL" }, { CLASS: "SP9" }],
      BESTLAPS: [{ CLASS: "Total", LAPTIME: "7:54.218" }, { CLASS: "Cup3" }],
      BESTSECTORS: [
        { CLASS: "total", S1: "2:30.100" },
        { CLASS: "SP-Pro" },
      ],
    })

    expect(availableStatClasses(stats)).toEqual(["Cup3", "SP-Pro", "SP9"])
  })

  it("skips empty, whitespace-only, and null CLASS values", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "" },
        { CLASS: "   " },
        { CLASS: null },
        { CLASS: "SP9" },
      ],
      BESTLAPS: [{ CLASS: "  Cup3  ", LAPTIME: "7:54.218" }],
      BESTSECTORS: [{ CLASS: undefined }],
    })

    expect(availableStatClasses(stats)).toEqual(["Cup3", "SP9"])
  })

  it("returns the result sorted alphabetically via localeCompare", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "V6" },
        { CLASS: "AT" },
        { CLASS: "Cup3" },
        { CLASS: "SP9" },
        { CLASS: "SP-Pro" },
      ],
    })

    const result = availableStatClasses(stats)
    expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b)))
    expect(result[0]).toBe("AT")
  })
})

describe("formatDeltaSeconds", () => {
  it("prepends a + and appends ' s' for positive deltas", () => {
    expect(formatDeltaSeconds(1.234)).toBe("+1.234 s")
    expect(formatDeltaSeconds(2.816)).toBe("+2.816 s")
  })

  it("uses the typographic minus glyph (U+2212) for negative deltas", () => {
    expect(formatDeltaSeconds(-2.5)).toBe("\u22122.500 s")
    expect(formatDeltaSeconds(-1.234)).toBe("\u22121.234 s")
  })

  it("returns ±0 s for zero or sub-millisecond deltas", () => {
    expect(formatDeltaSeconds(0)).toBe("\u00b10 s")
    expect(formatDeltaSeconds(0.0001)).toBe("\u00b10 s")
    expect(formatDeltaSeconds(-0.0009)).toBe("\u00b10 s")
  })

  it("formats deltas larger than a minute with the m:ss.SSS layout", () => {
    expect(formatDeltaSeconds(75.5)).toBe("+1:15.500 s")
  })

  it("returns em-dash for non-finite inputs", () => {
    expect(formatDeltaSeconds(Number.NaN)).toBe("—")
    expect(formatDeltaSeconds(Number.POSITIVE_INFINITY)).toBe("—")
  })
})

describe("isStatsClassExcluded", () => {
  it("returns true when the trimmed class label is in the excluded set", () => {
    expect(isStatsClassExcluded("SP9", new Set(["SP9"]))).toBe(true)
    expect(isStatsClassExcluded("  SP9  ", new Set(["SP9"]))).toBe(true)
  })

  it("is case-sensitive (matches the wire format from PID 9002)", () => {
    expect(isStatsClassExcluded("sp9", new Set(["SP9"]))).toBe(false)
    expect(isStatsClassExcluded("Sp9", new Set(["SP9"]))).toBe(false)
  })

  it("treats undefined / null / empty / whitespace labels as never excluded", () => {
    const ex = new Set(["SP9", ""])
    expect(isStatsClassExcluded(undefined, ex)).toBe(false)
    expect(isStatsClassExcluded(null, ex)).toBe(false)
    expect(isStatsClassExcluded("", ex)).toBe(false)
    expect(isStatsClassExcluded("   ", ex)).toBe(false)
  })

  it("returns false when the excluded set is empty", () => {
    expect(isStatsClassExcluded("SP9", new Set())).toBe(false)
  })

  it("supports numeric class labels by stringifying them", () => {
    expect(isStatsClassExcluded(7, new Set(["7"]))).toBe(true)
    expect(isStatsClassExcluded(7, new Set(["8"]))).toBe(false)
  })
})

describe("filterRowsByExcludedClasses", () => {
  it("returns [] for null / undefined / empty inputs", () => {
    expect(filterRowsByExcludedClasses(null, new Set(["SP9"]))).toEqual([])
    expect(filterRowsByExcludedClasses(undefined, new Set(["SP9"]))).toEqual([])
    expect(filterRowsByExcludedClasses([], new Set(["SP9"]))).toEqual([])
  })

  it("returns a clone of all rows when the excluded set is empty", () => {
    const rows = [{ CLASS: "SP9" }, { CLASS: "Cup3" }]
    const out = filterRowsByExcludedClasses(rows, new Set())
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })

  it("excludes matching rows and preserves the original order of survivors", () => {
    const rows = [
      { CLASS: "SP9", id: 1 },
      { CLASS: "SP-Pro", id: 2 },
      { CLASS: "Cup3", id: 3 },
      { CLASS: "SP9", id: 4 },
      { CLASS: "V6", id: 5 },
    ]
    const out = filterRowsByExcludedClasses(rows, new Set(["SP9", "V6"]))
    expect(out.map((r) => r.id)).toEqual([2, 3])
  })

  it("keeps rows with missing / empty CLASS", () => {
    const rows = [
      { CLASS: undefined },
      { CLASS: null },
      { CLASS: "" },
      { CLASS: "  " },
      { CLASS: "SP9" },
    ]
    const out = filterRowsByExcludedClasses(rows, new Set(["SP9"]))
    expect(out).toHaveLength(4)
    expect(out.map((r) => r.CLASS)).toEqual([undefined, null, "", "  "])
  })
})

describe("classKpis with excludedStatsClasses", () => {
  it("excludes LEADING rows from activeClasses and leadingCount", () => {
    const stats = frame({
      LEADING: [{ CLASS: "SP9" }, { CLASS: "SP-Pro" }, { CLASS: "Cup3" }],
    })

    const result = classKpis(stats, new Set(["SP9"]))
    expect(result.activeClasses).toBe(2)
    expect(result.leadingCount).toBe(2)
  })

  it("ignores BESTLAPS rows whose CLASS is excluded when picking the fastest", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "7:30.000" },
        { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
      ],
    })

    const result = classKpis(stats, new Set(["SP9"]))
    expect(result.fastestLap?.classLabel).toBe("Cup3")
    expect(result.fastestLap?.carNumber).toBe("55")
  })

  it("returns null fastestLap when every BESTLAPS row is excluded", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "7:30.000" },
        { CLASS: "SP9", NR: "200", LAPTIME: "7:31.000" },
      ],
    })

    expect(classKpis(stats, new Set(["SP9"])).fastestLap).toBeNull()
  })

  it("does not filter BESTSECTORS — theoreticalBestSeconds (TOTAL row) stays unchanged", () => {
    const stats = frame({
      BESTSECTORS: [
        {
          CLASS: "TOTAL",
          S1: "2:30.100",
          S2: "2:35.200",
          S3: "2:46.102",
        },
      ],
    })

    const baseline = classKpis(stats).theoreticalBestSeconds
    const filtered = classKpis(stats, new Set(["TOTAL", "SP9"]))
      .theoreticalBestSeconds
    expect(filtered).not.toBeNull()
    expect(filtered).toBeCloseTo(baseline ?? Number.NaN, 6)
  })

  it("defaults to no filter when the second arg is omitted (back-compat)", () => {
    const stats = frame({
      LEADING: [{ CLASS: "SP9" }, { CLASS: "Cup3" }],
      BESTLAPS: [{ CLASS: "SP9", NR: "100", LAPTIME: "7:30.000" }],
    })

    expect(classKpis(stats).activeClasses).toBe(2)
    expect(classKpis(stats).fastestLap?.classLabel).toBe("SP9")
  })
})

describe("bestLapsByClass", () => {
  it("returns [] for null / undefined / missing BESTLAPS", () => {
    expect(bestLapsByClass(null)).toEqual([])
    expect(bestLapsByClass(undefined)).toEqual([])
    expect(bestLapsByClass(frame({}))).toEqual([])
    expect(bestLapsByClass(frame({ BESTLAPS: [] }))).toEqual([])
  })

  it("sorts ascending and assigns rank, widthPct, opacityStop for three classes", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
        { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
        { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
      ],
    })

    const rows = bestLapsByClass(stats)
    expect(rows.map((r) => r.classLabel)).toEqual(["SP-Pro", "Cup3", "SP9"])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(rows.map((r) => r.opacityStop)).toEqual([100, 80, 60])
    expect(rows[0]!.widthPct).toBe(100)
    expect(rows[0]!.display).toBe("7:54.218")
    expect(rows[1]!.widthPct).toBeCloseTo((474.218 / 479.001) * 100, 3)
    expect(rows[2]!.widthPct).toBeCloseTo((474.218 / 481.5) * 100, 3)
  })

  it("skips the TOTAL row (case-insensitive)", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "TOTAL", NR: "—", LAPTIME: "7:50.000" },
        { CLASS: "total", NR: "—", LAPTIME: "7:51.000" },
        { CLASS: "SP9", NR: "100", LAPTIME: "7:54.218" },
      ],
    })

    const rows = bestLapsByClass(stats)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.classLabel).toBe("SP9")
  })

  it("skips classes present in excludedStatsClasses", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP9", NR: "100", LAPTIME: "7:30.000" },
        { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
      ],
    })

    const rows = bestLapsByClass(stats, new Set(["SP9"]))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.classLabel).toBe("Cup3")
    expect(rows[0]!.rank).toBe(1)
    expect(rows[0]!.widthPct).toBe(100)
    expect(rows[0]!.opacityStop).toBe(100)
  })

  it("maps ranks 1..6 to opacity stops 100/80/60/40/20/20", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "A", NR: "1", LAPTIME: "7:50.000" },
        { CLASS: "B", NR: "2", LAPTIME: "7:51.000" },
        { CLASS: "C", NR: "3", LAPTIME: "7:52.000" },
        { CLASS: "D", NR: "4", LAPTIME: "7:53.000" },
        { CLASS: "E", NR: "5", LAPTIME: "7:54.000" },
        { CLASS: "F", NR: "6", LAPTIME: "7:55.000" },
      ],
    })

    const rows = bestLapsByClass(stats)
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6])
    expect(rows.map((r) => r.opacityStop)).toEqual([100, 80, 60, 40, 20, 20])
  })
})
