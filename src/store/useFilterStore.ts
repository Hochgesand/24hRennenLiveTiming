import { create } from "zustand"

import type { FilterUrlState } from "@/lib/urlFilters"
import { parseFilterParamsFromSearch } from "@/lib/urlFilters"

export type FilterSlice = {
  /** Class names (CLASSNAME string) excluded from the leaderboard. Empty = show all. */
  excludedClasses: Set<string>
  /** Pro/Am keys (PRO string) excluded from the leaderboard. Empty = show all. */
  excludedProams: Set<string>
  /** Leaderboard column keys excluded from view (see `leaderboardColumns`). Empty = show all. */
  excludedColumns: Set<string>
  toggleExcludedClass: (className: string) => void
  toggleExcludedProam: (pro: string) => void
  toggleExcludedColumn: (columnKey: string) => void
  clearExcludedClasses: () => void
  clearExcludedProams: () => void
  clearExcludedColumns: () => void
  /** Replace all filter sets (e.g. URL hydration). */
  setExcludedFilters: (next: FilterUrlState) => void
}

function emptyFilters(): FilterUrlState {
  return {
    excludedClasses: new Set(),
    excludedProams: new Set(),
    excludedColumns: new Set(),
  }
}

function initialFilters(): FilterUrlState {
  if (typeof window === "undefined") {
    return emptyFilters()
  }
  return parseFilterParamsFromSearch(window.location.search)
}

const initial = initialFilters()

export const useFilterStore = create<FilterSlice>((set) => ({
  excludedClasses: initial.excludedClasses,
  excludedProams: initial.excludedProams,
  excludedColumns: initial.excludedColumns,
  toggleExcludedClass: (className) =>
    set((s) => {
      const next = new Set(s.excludedClasses)
      if (next.has(className)) {
        next.delete(className)
      } else {
        next.add(className)
      }
      return { excludedClasses: next }
    }),
  toggleExcludedProam: (pro) =>
    set((s) => {
      const next = new Set(s.excludedProams)
      if (next.has(pro)) {
        next.delete(pro)
      } else {
        next.add(pro)
      }
      return { excludedProams: next }
    }),
  toggleExcludedColumn: (columnKey) =>
    set((s) => {
      const key = columnKey.toLowerCase()
      const next = new Set(s.excludedColumns)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return { excludedColumns: next }
    }),
  clearExcludedClasses: () => set({ excludedClasses: new Set() }),
  clearExcludedProams: () => set({ excludedProams: new Set() }),
  clearExcludedColumns: () => set({ excludedColumns: new Set() }),
  setExcludedFilters: (next) =>
    set({
      excludedClasses: new Set(next.excludedClasses),
      excludedProams: new Set(next.excludedProams),
      excludedColumns: new Set(next.excludedColumns),
    }),
}))
