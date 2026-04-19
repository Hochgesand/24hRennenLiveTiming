import { beforeEach, describe, expect, it } from "vitest"

import { useFilterStore } from "./useFilterStore"

function resetStore(): void {
  useFilterStore.setState({
    excludedClasses: new Set(),
    excludedProams: new Set(),
    excludedColumns: new Set(),
    excludedStatsClasses: new Set(),
  })
}

describe("useFilterStore — excludedStatsClasses", () => {
  beforeEach(() => {
    resetStore()
  })

  it("toggleExcludedStatsClass adds, then removes the same class", () => {
    useFilterStore.getState().toggleExcludedStatsClass("SP9")
    expect(useFilterStore.getState().excludedStatsClasses.has("SP9")).toBe(true)

    useFilterStore.getState().toggleExcludedStatsClass("SP9")
    expect(useFilterStore.getState().excludedStatsClasses.has("SP9")).toBe(false)
    expect(useFilterStore.getState().excludedStatsClasses.size).toBe(0)
  })

  it("toggleExcludedStatsClass leaves the leaderboard slice untouched", () => {
    useFilterStore.getState().toggleExcludedStatsClass("SP9")
    expect(useFilterStore.getState().excludedClasses.size).toBe(0)
  })

  it("clearExcludedStatsClasses empties the set", () => {
    useFilterStore.getState().toggleExcludedStatsClass("SP9")
    useFilterStore.getState().toggleExcludedStatsClass("Cup3")
    expect(useFilterStore.getState().excludedStatsClasses.size).toBe(2)

    useFilterStore.getState().clearExcludedStatsClasses()
    expect(useFilterStore.getState().excludedStatsClasses.size).toBe(0)
  })

  it("setExcludedFilters replaces the excludedStatsClasses slice", () => {
    useFilterStore.getState().toggleExcludedStatsClass("Cup3")
    useFilterStore.getState().setExcludedFilters({
      excludedClasses: new Set(),
      excludedProams: new Set(),
      excludedColumns: new Set(),
      excludedStatsClasses: new Set(["X"]),
    })
    expect([...useFilterStore.getState().excludedStatsClasses]).toEqual(["X"])
  })

  it("setExcludedFilters clones the incoming set so external mutation does not leak", () => {
    const incoming = new Set(["SP9"])
    useFilterStore.getState().setExcludedFilters({
      excludedClasses: new Set(),
      excludedProams: new Set(),
      excludedColumns: new Set(),
      excludedStatsClasses: incoming,
    })
    incoming.add("Cup3")
    expect(useFilterStore.getState().excludedStatsClasses.has("Cup3")).toBe(false)
  })
})
