import { useEffect, useSyncExternalStore } from "react"

import {
  filterUrlStateEqual,
  parseFilterParamsFromSearch,
  searchWithUpdatedFilters,
  type FilterUrlState,
} from "@/lib/urlFilters"
import { useFilterStore, type FilterSlice } from "@/store/useFilterStore"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

function getSearchSnapshot(): string {
  return window.location.search
}

function getServerSearchSnapshot(): string {
  return ""
}

function pickFilters(s: FilterSlice): FilterUrlState {
  return {
    excludedClasses: s.excludedClasses,
    excludedProams: s.excludedProams,
    excludedColumns: s.excludedColumns,
  }
}

/**
 * Hydrates the filter store from the URL on navigation, and writes filter state back with
 * `history.replaceState` when filters change (preserves `event`, `config`, and other params).
 */
export function useSyncFiltersFromUrl(): void {
  const search = useSyncExternalStore(subscribe, getSearchSnapshot, getServerSearchSnapshot)

  useEffect(() => {
    const parsed = parseFilterParamsFromSearch(search)
    const current = pickFilters(useFilterStore.getState())
    if (!filterUrlStateEqual(parsed, current)) {
      useFilterStore.getState().setExcludedFilters(parsed)
    }
  }, [search])

  useEffect(() => {
    return useFilterStore.subscribe((state) => {
      const next = pickFilters(state)
      if (filterUrlStateEqual(next, parseFilterParamsFromSearch(window.location.search))) {
        return
      }
      const nextSearch = searchWithUpdatedFilters(window.location.search, next)
      if (nextSearch === window.location.search) {
        return
      }
      history.replaceState(
        history.state,
        "",
        `${window.location.pathname}${nextSearch}${window.location.hash}`
      )
    })
  }, [])
}
