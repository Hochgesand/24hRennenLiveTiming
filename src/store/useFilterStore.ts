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
  /**
   * Class names hidden from the Statistik tab visualisations (KPI bars, heatmap,
   * leading table). Independent from {@link excludedClasses} so spectators can
   * keep a wide leaderboard while focusing the stats cockpit on a class group.
   * Persisted via the `excStatsClass` URL param (alias `statsExcludedClasses`).
   */
  excludedStatsClasses: Set<string>
  toggleExcludedClass: (className: string) => void
  toggleExcludedProam: (pro: string) => void
  toggleExcludedColumn: (columnKey: string) => void
  toggleExcludedStatsClass: (className: string) => void
  clearExcludedClasses: () => void
  clearExcludedProams: () => void
  clearExcludedColumns: () => void
  clearExcludedStatsClasses: () => void
  /** Replace all filter sets (e.g. URL hydration). */
  setExcludedFilters: (next: FilterUrlState) => void
}

function emptyFilters(): FilterUrlState {
  return {
    excludedClasses: new Set(),
    excludedProams: new Set(),
    excludedColumns: new Set(),
    excludedStatsClasses: new Set(),
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
  excludedStatsClasses: initial.excludedStatsClasses,
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
  toggleExcludedStatsClass: (className) =>
    set((s) => {
      const next = new Set(s.excludedStatsClasses)
      if (next.has(className)) {
        next.delete(className)
      } else {
        next.add(className)
      }
      return { excludedStatsClasses: next }
    }),
  clearExcludedClasses: () => set({ excludedClasses: new Set() }),
  clearExcludedProams: () => set({ excludedProams: new Set() }),
  clearExcludedColumns: () => set({ excludedColumns: new Set() }),
  clearExcludedStatsClasses: () => set({ excludedStatsClasses: new Set() }),
  setExcludedFilters: (next) =>
    set({
      excludedClasses: new Set(next.excludedClasses),
      excludedProams: new Set(next.excludedProams),
      excludedColumns: new Set(next.excludedColumns),
      excludedStatsClasses: new Set(next.excludedStatsClasses),
    }),
}))
