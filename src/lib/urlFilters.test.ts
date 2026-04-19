import { describe, expect, it } from "vitest"

import { defaultExcludedLeaderboardColumns } from "./leaderboardColumns"
import {
  PARAM_EXC_CLASS,
  PARAM_EXC_COL,
  PARAM_EXC_PRO,
  PARAM_EXC_STATS_CLASS,
  filterUrlStateEqual,
  parseFilterParamsFromSearch,
  searchWithUpdatedFilters,
} from "./urlFilters"

describe("parseFilterParamsFromSearch / searchWithUpdatedFilters", () => {
  it("uses default excluded columns when no col params are present", () => {
    const parsed = parseFilterParamsFromSearch("")
    expect(parsed.excludedColumns).toEqual(defaultExcludedLeaderboardColumns())
  })

  it("round-trips filter state and preserves event + config", () => {
    const search =
      "?event=50&config=w3&" +
      `${PARAM_EXC_CLASS}=Cup2%2CSP9&${PARAM_EXC_PRO}=Pro&${PARAM_EXC_COL}=team%2Ccar`
    const parsed = parseFilterParamsFromSearch(search)
    expect(parsed.excludedClasses.has("Cup2")).toBe(true)
    expect(parsed.excludedClasses.has("SP9")).toBe(true)
    expect(parsed.excludedProams.has("Pro")).toBe(true)
    expect(parsed.excludedColumns.has("team")).toBe(true)
    expect(parsed.excludedColumns.has("car")).toBe(true)

    const next = searchWithUpdatedFilters(search, parsed)
    const again = parseFilterParamsFromSearch(next)
    expect(filterUrlStateEqual(parsed, again)).toBe(true)
    expect(next.includes("event=50")).toBe(true)
    expect(next.includes("config=w3")).toBe(true)
  })

  it("normalizes column keys to lowercase", () => {
    const parsed = parseFilterParamsFromSearch(`?${PARAM_EXC_COL}=Team%2CCAR`)
    expect(parsed.excludedColumns.has("team")).toBe(true)
    expect(parsed.excludedColumns.has("car")).toBe(true)
  })

  it("merges repeated excClass keys (and comma lists) into one set", () => {
    const search = `?${PARAM_EXC_CLASS}=Cup2%2CSP9&${PARAM_EXC_CLASS}=GT3&${PARAM_EXC_CLASS}=Cup2`
    const parsed = parseFilterParamsFromSearch(search)
    expect([...parsed.excludedClasses].sort()).toEqual(["Cup2", "GT3", "SP9"])
  })

  it("merges repeated excPro keys", () => {
    const search = `?${PARAM_EXC_PRO}=Pro&${PARAM_EXC_PRO}=Am`
    const parsed = parseFilterParamsFromSearch(search)
    expect([...parsed.excludedProams].sort()).toEqual(["Am", "Pro"])
  })

  it("merges repeated excCol keys with lowercase normalization", () => {
    const search = `?${PARAM_EXC_COL}=Team&${PARAM_EXC_COL}=CAR`
    const parsed = parseFilterParamsFromSearch(search)
    expect([...parsed.excludedColumns].sort()).toEqual(["car", "team"])
  })

  it("preserves merged excClass through searchWithUpdatedFilters round-trip", () => {
    const search = `?event=50&config=w3&${PARAM_EXC_CLASS}=A&${PARAM_EXC_CLASS}=B`
    const parsed = parseFilterParamsFromSearch(search)
    const next = searchWithUpdatedFilters(search, parsed)
    const again = parseFilterParamsFromSearch(next)
    expect(filterUrlStateEqual(parsed, again)).toBe(true)
    expect(next).toMatch(/excClass=A%2CB/)
    expect(next.includes("event=50")).toBe(true)
  })

  it("parses excludedStatsClasses from the short excStatsClass key", () => {
    const parsed = parseFilterParamsFromSearch(`?${PARAM_EXC_STATS_CLASS}=SP9%2CCup3`)
    expect([...parsed.excludedStatsClasses].sort()).toEqual(["Cup3", "SP9"])
  })

  it("parses excludedStatsClasses from the long statsExcludedClasses alias", () => {
    const parsed = parseFilterParamsFromSearch("?statsExcludedClasses=V6")
    expect([...parsed.excludedStatsClasses]).toEqual(["V6"])
  })

  it("merges both excStatsClass and statsExcludedClasses into one set", () => {
    const parsed = parseFilterParamsFromSearch(
      `?${PARAM_EXC_STATS_CLASS}=SP9&statsExcludedClasses=V6`
    )
    expect([...parsed.excludedStatsClasses].sort()).toEqual(["SP9", "V6"])
  })

  it("emits the short excStatsClass key (not the long alias) when serialising", () => {
    const search = "?statsExcludedClasses=V6%2CSP9"
    const parsed = parseFilterParamsFromSearch(search)
    const next = searchWithUpdatedFilters(search, parsed)
    expect(next).toMatch(/excStatsClass=SP9%2CV6/)
    expect(next.includes("statsExcludedClasses=")).toBe(false)
  })

  it("round-trips a stats-class set while preserving leading event + config", () => {
    const search = `?event=50&config=w3&${PARAM_EXC_STATS_CLASS}=Cup3%2CV6`
    const parsed = parseFilterParamsFromSearch(search)
    const next = searchWithUpdatedFilters(search, parsed)
    const again = parseFilterParamsFromSearch(next)
    expect(filterUrlStateEqual(parsed, again)).toBe(true)
    expect(next.includes("event=50")).toBe(true)
    expect(next.includes("config=w3")).toBe(true)
    expect(next).toMatch(/excStatsClass=Cup3%2CV6/)
  })

  it("filterUrlStateEqual returns false when only excludedStatsClasses differs", () => {
    const a = parseFilterParamsFromSearch("")
    const b = parseFilterParamsFromSearch(`?${PARAM_EXC_STATS_CLASS}=SP9`)
    expect(filterUrlStateEqual(a, b)).toBe(false)
  })
})
