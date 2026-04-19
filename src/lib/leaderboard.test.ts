import { describe, expect, it } from "vitest"

import { filterLeaderboardRowsByExclusions, sortLeaderboardRows } from "./leaderboard"

describe("sortLeaderboardRows", () => {
  it("returns empty array for undefined or empty input", () => {
    expect(sortLeaderboardRows(undefined)).toEqual([])
    expect(sortLeaderboardRows([])).toEqual([])
  })

  it("sorts by POSITION ascending", () => {
    const rows = [
      { POSITION: 3, NAME: "C" },
      { POSITION: 1, NAME: "A" },
      { POSITION: 2, NAME: "B" },
    ]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["A", "B", "C"])
  })

  it("accepts POSITION as string", () => {
    const rows = [{ POSITION: "2", NAME: "B" }, { POSITION: "1", NAME: "A" }]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["A", "B"])
  })

  it("is stable by index when POSITION ties", () => {
    const rows = [
      { POSITION: 1, NAME: "first" },
      { POSITION: 1, NAME: "second" },
    ]
    const sorted = sortLeaderboardRows(rows)
    expect(sorted.map((r) => r.NAME)).toEqual(["first", "second"])
  })

  it("skips null / non-object entries", () => {
    const rows = [null, { POSITION: 1, NAME: "Ok" }, "x"] as unknown as Parameters<
      typeof sortLeaderboardRows
    >[0]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["Ok"])
  })

  it("when no row has valid POSITION, preserves original order of object rows", () => {
    const rows = [{ NAME: "A" }, { NAME: "B" }, { POSITION: "nope", NAME: "C" }]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["A", "B", "C"])
  })

  it("lists rows without POSITION after all positioned rows, stable by index", () => {
    const rows = [
      { POSITION: 2, NAME: "P2" },
      { NAME: "X" },
      { POSITION: 1, NAME: "P1" },
      { NAME: "Y" },
    ]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["P1", "P2", "X", "Y"])
  })

  it("filters invalid POSITION values like NaN", () => {
    const rows = [{ POSITION: Number.NaN, NAME: "Bad" }, { POSITION: 1, NAME: "Good" }]
    expect(sortLeaderboardRows(rows).map((r) => r.NAME)).toEqual(["Good", "Bad"])
  })
})

describe("filterLeaderboardRowsByExclusions", () => {
  it("returns the same rows when no exclusions", () => {
    const rows = [
      { CLASSNAME: "A", PRO: "Pro", NAME: "1" },
      { CLASSNAME: "B", PRO: "Am", NAME: "2" },
    ]
    expect(filterLeaderboardRowsByExclusions(rows, new Set(), new Set())).toEqual(rows)
  })

  it("drops rows by CLASSNAME", () => {
    const rows = [
      { CLASSNAME: "GT", PRO: "Pro", NAME: "a" },
      { CLASSNAME: "Cup", PRO: "Am", NAME: "b" },
    ]
    expect(filterLeaderboardRowsByExclusions(rows, new Set(["GT"]), new Set()).map((r) => r.NAME)).toEqual(
      ["b"]
    )
  })

  it("drops rows by PRO", () => {
    const rows = [
      { CLASSNAME: "GT", PRO: "Pro", NAME: "a" },
      { CLASSNAME: "Cup", PRO: "Am", NAME: "b" },
    ]
    expect(filterLeaderboardRowsByExclusions(rows, new Set(), new Set(["Am"])).map((r) => r.NAME)).toEqual(
      ["a"]
    )
  })
})
