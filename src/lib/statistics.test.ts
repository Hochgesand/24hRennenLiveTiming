import { describe, expect, it } from "vitest"

import {
  availableStatClasses,
  bestLapsByClass,
  classKpis,
  composeDriverTeam,
  enrichedLeading,
  filterRowsByExcludedClasses,
  formatDeltaSeconds,
  isStatsClassExcluded,
  sectorHeatmap,
} from "@/lib/statistics"
import type { Pid0Frame, Pid9002Frame, RawResultRow } from "@/lib/types"

function frame(
  partial: Partial<Pid9002Frame>
): Pid9002Frame {
  return {
    PID: "9002",
    ...partial,
  } as Pid9002Frame
}

function snapshot(rows: RawResultRow[]): Pid0Frame {
  return { PID: "0", RESULT: rows } as Pid0Frame
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

  it("dedupes per class, keeping only the fastest lap when BESTLAPS has multiple rows for the same class", () => {
    const stats = frame({
      BESTLAPS: [
        { CLASS: "SP-X", NR: "81", LAPTIME: "8:21.515" },
        { CLASS: "SP-X", NR: "81", LAPTIME: "8:18.620" },
        { CLASS: "SP-X", NR: "81", LAPTIME: "8:21.325" },
        { CLASS: "SP9", NR: "3", LAPTIME: "8:17.477" },
        { CLASS: "SP9", NR: "3", LAPTIME: "8:10.453" },
        { CLASS: "SP9", NR: "84", LAPTIME: "8:17.419" },
      ],
    })

    const rows = bestLapsByClass(stats)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.classLabel)).toEqual(["SP9", "SP-X"])
    expect(rows[0]!.display).toBe("8:10.453")
    expect(rows[0]!.carNumber).toBe("3")
    expect(rows[1]!.display).toBe("8:18.620")
    expect(rows[1]!.carNumber).toBe("81")
    expect(rows.map((r) => r.rank)).toEqual([1, 2])
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

describe("composeDriverTeam", () => {
  it("joins NAME and TEAM with ` · ` when both are present", () => {
    expect(
      composeDriverTeam({ NAME: "Max Mustermann", TEAM: "Manthey EMA" })
    ).toBe("Max Mustermann · Manthey EMA")
  })

  it("returns just the driver when TEAM is missing / blank", () => {
    expect(composeDriverTeam({ NAME: "Max Mustermann" })).toBe("Max Mustermann")
    expect(composeDriverTeam({ NAME: "Max Mustermann", TEAM: "" })).toBe(
      "Max Mustermann"
    )
    expect(composeDriverTeam({ NAME: "Max Mustermann", TEAM: "   " })).toBe(
      "Max Mustermann"
    )
  })

  it("returns just the team when NAME is missing / blank", () => {
    expect(composeDriverTeam({ TEAM: "Manthey EMA" })).toBe("Manthey EMA")
    expect(composeDriverTeam({ NAME: "", TEAM: "Manthey EMA" })).toBe(
      "Manthey EMA"
    )
  })

  it("returns null when both NAME and TEAM are missing / blank", () => {
    expect(composeDriverTeam({})).toBeNull()
    expect(composeDriverTeam({ NAME: "", TEAM: "" })).toBeNull()
    expect(composeDriverTeam({ NAME: "  ", TEAM: "  " })).toBeNull()
  })

  it("trims surrounding whitespace from both sides", () => {
    expect(
      composeDriverTeam({ NAME: "  Max Mustermann  ", TEAM: " Manthey EMA " })
    ).toBe("Max Mustermann · Manthey EMA")
  })
})

describe("bestLapsByClass — driverTeam join", () => {
  const stats = frame({
    BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
  })

  it("returns driverTeam=null for every row when snapshot is null/undefined", () => {
    const a = bestLapsByClass(stats, new Set(), null)
    const b = bestLapsByClass(stats, new Set(), undefined)
    const c = bestLapsByClass(stats)
    expect(a[0]!.driverTeam).toBeNull()
    expect(b[0]!.driverTeam).toBeNull()
    expect(c[0]!.driverTeam).toBeNull()
  })

  it("composes `driver · team` when RESULT row has both driver and team", () => {
    const snap = snapshot([
      { STNR: "911", NAME: "Max Mustermann", TEAM: "Manthey EMA" },
    ])
    const rows = bestLapsByClass(stats, new Set(), snap)
    expect(rows[0]!.driverTeam).toBe("Max Mustermann · Manthey EMA")
  })

  it("composes just the driver when RESULT row has only NAME", () => {
    const snap = snapshot([{ STNR: "911", NAME: "Max Mustermann" }])
    const rows = bestLapsByClass(stats, new Set(), snap)
    expect(rows[0]!.driverTeam).toBe("Max Mustermann")
  })

  it("composes just the team when RESULT row has only TEAM", () => {
    const snap = snapshot([{ STNR: "911", TEAM: "Manthey EMA" }])
    const rows = bestLapsByClass(stats, new Set(), snap)
    expect(rows[0]!.driverTeam).toBe("Manthey EMA")
  })

  it("returns driverTeam=null when no RESULT row's STNR matches the BESTLAPS NR", () => {
    const snap = snapshot([
      { STNR: "100", NAME: "Other Driver", TEAM: "Other Team" },
    ])
    const rows = bestLapsByClass(stats, new Set(), snap)
    expect(rows[0]!.driverTeam).toBeNull()
  })

  it("trims STNR / NR before matching (whitespace differences must not break join)", () => {
    const snap = snapshot([
      { STNR: "  911 ", NAME: "Max Mustermann", TEAM: "Manthey EMA" },
    ])
    const statsWithSpace = frame({
      BESTLAPS: [{ CLASS: "SP9", NR: " 911 ", LAPTIME: "7:54.218" }],
    })
    const rows = bestLapsByClass(statsWithSpace, new Set(), snap)
    expect(rows[0]!.driverTeam).toBe("Max Mustermann · Manthey EMA")
  })
})

describe("sectorHeatmap", () => {
  it("returns an empty heatmap for null / undefined / no BESTSECTORS input", () => {
    const empty = {
      classes: [],
      sectorCount: 0,
      columnBestsSeconds: [],
      rows: [],
    }
    expect(sectorHeatmap(null)).toEqual(empty)
    expect(sectorHeatmap(undefined)).toEqual(empty)
    expect(sectorHeatmap(frame({}))).toEqual(empty)
    expect(sectorHeatmap(frame({ BESTSECTORS: [] }))).toEqual(empty)
  })

  it("derives sectorCount, columnBestsSeconds, and per-cell metadata for 3 classes × 4 sectors", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "81.0", S2: "94.0", S3: "120.0", S4: "76.0", LAPTIME: "6:11.000" },
        { CLASS: "SP-X", S1: "82.0", S2: "95.0", S3: "121.0", S4: "75.0", LAPTIME: "6:13.000" },
        { CLASS: "CUP2", S1: "85.0", S2: "99.0", S3: "131.0", S4: "81.0", LAPTIME: "6:36.000" },
      ],
    })

    const data = sectorHeatmap(stats)
    expect(data.sectorCount).toBe(4)
    expect(data.classes).toEqual(["SP9", "SP-X", "CUP2"])
    expect(data.columnBestsSeconds).toEqual([81, 94, 120, 75])

    expect(data.rows[0]!.cells[0]!).toMatchObject({
      seconds: 81,
      isColumnBest: true,
      opacityStop: 100,
      deltaSeconds: 0,
    })
    expect(data.rows[1]!.cells[3]!).toMatchObject({
      seconds: 75,
      isColumnBest: true,
      opacityStop: 100,
    })
    expect(data.rows[2]!.cells[0]!.isColumnBest).toBe(false)
    expect(data.rows[2]!.cells[0]!.deltaSeconds).toBeCloseTo(4, 6)
    expect(data.rows[0]!.lapTimeSeconds).toBeCloseTo(371, 6)
    expect(data.rows[0]!.lapTimeDisplay).toBe("6:11.000")
  })

  it("treats missing S{n} cells as null and keeps them out of the column best", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "81.0", S2: "94.0", S3: "120.0", S4: "76.0", S5: "30.0" },
        { CLASS: "SP-X", S1: "82.0", S2: "95.0", S3: "121.0", S4: "75.0" /* S5 missing */ },
      ],
    })

    const data = sectorHeatmap(stats)
    expect(data.sectorCount).toBe(5)
    expect(data.columnBestsSeconds[4]).toBe(30)

    const spxS5 = data.rows[1]!.cells[4]!
    expect(spxS5.seconds).toBeNull()
    expect(spxS5.display).toBe("")
    expect(spxS5.opacityStop).toBeNull()
    expect(spxS5.deltaSeconds).toBeNull()
    expect(spxS5.deltaRel).toBeNull()
    expect(spxS5.isColumnBest).toBe(false)
  })

  it("filters non-TOTAL classes via excludedStatsClasses, including out of column best", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "81.0", S2: "94.0" },
        { CLASS: "SP-X", S1: "70.0", S2: "95.0" },
        { CLASS: "CUP2", S1: "85.0", S2: "99.0" },
      ],
    })

    const data = sectorHeatmap(stats, new Set(["SP-X"]))
    expect(data.classes).toEqual(["SP9", "CUP2"])
    expect(data.columnBestsSeconds[0]).toBe(81)
    expect(data.rows.find((r) => r.classLabel === "SP-X")).toBeUndefined()
  })

  it("never filters TOTAL — even when 'TOTAL' is in excludedStatsClasses — and renders it first", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "SP9", S1: "81.0", S2: "94.0", LAPTIME: "5:55.000" },
        { CLASS: "TOTAL", S1: "80.0", S2: "92.0", LAPTIME: "5:50.000" },
        { CLASS: "CUP2", S1: "85.0", S2: "99.0", LAPTIME: "6:00.000" },
      ],
    })

    const data = sectorHeatmap(stats, new Set(["TOTAL", "SP9"]))
    expect(data.classes[0]).toBe("TOTAL")
    expect(data.classes).toEqual(["TOTAL", "CUP2"])
    expect(data.columnBestsSeconds).toEqual([80, 92])
    expect(data.rows[0]!.cells[0]!.isColumnBest).toBe(true)
  })

  it("includes TOTAL in the column best computation by default", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "TOTAL", S1: "70.0", S2: "85.0" },
        { CLASS: "SP9", S1: "81.0", S2: "94.0" },
        { CLASS: "CUP2", S1: "85.0", S2: "99.0" },
      ],
    })
    const data = sectorHeatmap(stats)
    expect(data.classes).toEqual(["TOTAL", "SP9", "CUP2"])
    expect(data.columnBestsSeconds).toEqual([70, 85])
    expect(data.rows[0]!.cells[0]!.isColumnBest).toBe(true)
    expect(data.rows[1]!.cells[0]!.isColumnBest).toBe(false)
  })

  it("bins synthetic deltas onto the documented opacity stops", () => {
    // Column best is 100s. Add synthetic rows so each row's S1 maps to a
    // specific deltaRel and therefore a specific opacity stop.
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "C0", S1: "100.0" }, // 0 % → 100
        { CLASS: "C1", S1: "100.4" }, // 0.4 % → 90
        { CLASS: "C2", S1: "101.0" }, // 1 % → 80
        { CLASS: "C3", S1: "101.5" }, // 1.5 % → 70
        { CLASS: "C4", S1: "102.5" }, // 2.5 % → 60
        { CLASS: "C5", S1: "104.0" }, // 4 % → 50
        { CLASS: "C6", S1: "107.0" }, // 7 % → 40
        { CLASS: "C7", S1: "109.0" }, // 9 % → 30
        { CLASS: "C8", S1: "112.0" }, // 12 % → 20
        { CLASS: "C9", S1: "120.0" }, // 20 % → 10
      ],
    })

    const data = sectorHeatmap(stats)
    const stops = data.rows.map((r) => r.cells[0]!.opacityStop)
    expect(stops).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10])
  })

  it("sets lapTimeDisplay to '' when the row has no parseable LAPTIME", () => {
    const stats = frame({
      BESTSECTORS: [{ CLASS: "SP9", S1: "81.0", LAPTIME: "DNF" }],
    })
    const data = sectorHeatmap(stats)
    expect(data.rows[0]!.lapTimeSeconds).toBeNull()
    expect(data.rows[0]!.lapTimeDisplay).toBe("")
  })

  it("preserves wire order for non-TOTAL classes (TOTAL still goes first)", () => {
    const stats = frame({
      BESTSECTORS: [
        { CLASS: "Z", S1: "70.0" },
        { CLASS: "A", S1: "80.0" },
        { CLASS: "TOTAL", S1: "60.0" },
        { CLASS: "M", S1: "75.0" },
      ],
    })
    const data = sectorHeatmap(stats)
    expect(data.classes).toEqual(["TOTAL", "Z", "A", "M"])
  })
})

describe("enrichedLeading", () => {
  it("returns an empty rows array for null / undefined / empty stats", () => {
    expect(enrichedLeading(null)).toEqual({ rows: [] })
    expect(enrichedLeading(undefined)).toEqual({ rows: [] })
    expect(enrichedLeading(frame({}))).toEqual({ rows: [] })
    expect(enrichedLeading(frame({ LEADING: [] }))).toEqual({ rows: [] })
  })

  it("filters out the synthetic TOTAL row", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "TOTAL", NR: "0", LAPS: "200", SUM: "16:42:04.001" },
        { CLASS: "SP9", NR: "911", LAPS: "124", SUM: "16:41:22.401" },
      ],
    })
    const data = enrichedLeading(stats)
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]!.classLabel).toBe("SP9")
  })

  it("filters out classes that appear in excludedStatsClasses", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "SP9", NR: "911", LAPS: "124" },
        { CLASS: "CUP2", NR: "121", LAPS: "118" },
        { CLASS: "SP-X", NR: "706", LAPS: "122" },
      ],
    })
    const data = enrichedLeading(stats, null, new Set(["CUP2"]))
    expect(data.rows.map((r) => r.classLabel)).toEqual(["SP9", "SP-X"])
  })

  it("joins LEADING.NR with PID 0 RESULT.STNR via composeDriverTeam, em-dash otherwise", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "SP9", NR: "911", LAPS: "124", GAP: "" },
        { CLASS: "SP-X", NR: "706", LAPS: "122", GAP: "+2 Laps" },
      ],
    })
    const snap = snapshot([
      { STNR: "911", NAME: "Vanthorr / Estre / Preining", TEAM: "Manthey EMA" },
    ])

    const data = enrichedLeading(stats, snap)
    expect(data.rows[0]!.driverTeam).toBe(
      "Vanthorr / Estre / Preining · Manthey EMA"
    )
    expect(data.rows[1]!.driverTeam).toBeNull()
  })

  it("rewrites empty / 0 / Leader gap to the literal 'Leader' and flips isLeader", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "SP9", NR: "911", LAPS: "124", GAP: "" },
        { CLASS: "SP-X", NR: "706", LAPS: "122", GAP: "+2 Laps" },
        { CLASS: "CUP2", NR: "121", LAPS: "118", GAP: "0" },
        { CLASS: "VT2", NR: "333", LAPS: "108", GAP: "Leader" },
      ],
    })
    const data = enrichedLeading(stats)

    expect(data.rows[0]).toMatchObject({ gap: "Leader", isLeader: true })
    expect(data.rows[1]).toMatchObject({ gap: "+2 Laps", isLeader: false })
    expect(data.rows[2]).toMatchObject({ gap: "Leader", isLeader: true })
    expect(data.rows[3]).toMatchObject({ gap: "Leader", isLeader: true })
  })

  it("parses FROMLAP into fromLap as integer, null when missing or unparseable", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "SP9", NR: "911", LAPS: "124", FROMLAP: 142 },
        { CLASS: "SP-X", NR: "706", LAPS: "122", FROMLAP: "138" },
        { CLASS: "CUP2", NR: "121", LAPS: "118" /* FROMLAP missing */ },
        { CLASS: "VT2", NR: "333", LAPS: "108", FROMLAP: "—" },
      ],
    })
    const data = enrichedLeading(stats)
    expect(data.rows[0]!.fromLap).toBe(142)
    expect(data.rows[1]!.fromLap).toBe(138)
    expect(data.rows[2]!.fromLap).toBeNull()
    expect(data.rows[3]!.fromLap).toBeNull()
  })

  it("parses LAPS to a number, falls back to em-dash for missing nr / sum (rows with empty CLASS are dropped)", () => {
    const stats = frame({
      LEADING: [
        { CLASS: "VT2", NR: "  ", LAPS: "abc", SUM: "  " },
        { CLASS: "SP9", NR: "911", LAPS: 124, SUM: "16:41:22.401" },
      ],
    })
    const data = enrichedLeading(stats)
    expect(data.rows).toHaveLength(2)
    expect(data.rows[0]).toMatchObject({
      classLabel: "VT2",
      carNumber: "—",
      laps: null,
      sumDisplay: "—",
    })
    expect(data.rows[1]).toMatchObject({
      classLabel: "SP9",
      carNumber: "911",
      laps: 124,
      sumDisplay: "16:41:22.401",
    })
  })
})
