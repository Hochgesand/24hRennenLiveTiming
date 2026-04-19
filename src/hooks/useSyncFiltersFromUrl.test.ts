/**
 * Integration test for the `?tab=stats&statsExcludedClasses=…` URL round-trip
 * (PRD-statistics-cockpit.md §"URL / shareability" item 1).
 *
 * Asserts both directions:
 *   1. URL → store: mounting the hook with the legacy long alias in the URL
 *      hydrates `useFilterStore.excludedStatsClasses` with the parsed set.
 *   2. Store → URL: toggling a class off via the store action serialises the
 *      remaining set back to the URL using the new short `excStatsClass` key
 *      (the long alias is parse-only and never re-emitted).
 */
import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useSyncFiltersFromUrl } from "./useSyncFiltersFromUrl"
import { useFilterStore } from "@/store/useFilterStore"

function resetStore(): void {
  useFilterStore.setState({
    excludedClasses: new Set(),
    excludedProams: new Set(),
    excludedColumns: new Set(),
    excludedStatsClasses: new Set(),
  })
}

describe("useSyncFiltersFromUrl — ?tab=stats round-trip", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/")
    resetStore()
  })

  afterEach(() => {
    window.history.replaceState(null, "", "/")
    resetStore()
  })

  it("hydrates excludedStatsClasses from ?tab=stats&statsExcludedClasses=Cup3,V6 and serialises a toggled set back as ?excStatsClass=V6", () => {
    window.history.replaceState(null, "", "/?tab=stats&statsExcludedClasses=Cup3,V6")

    renderHook(() => useSyncFiltersFromUrl())

    const hydrated = useFilterStore.getState().excludedStatsClasses
    expect(hydrated).toEqual(new Set(["Cup3", "V6"]))

    act(() => {
      useFilterStore.getState().toggleExcludedStatsClass("Cup3")
    })

    expect(window.location.search).toContain("excStatsClass=V6")
    expect(window.location.search).not.toContain("statsExcludedClasses=")
    expect(window.location.search).toContain("tab=stats")
  })
})
