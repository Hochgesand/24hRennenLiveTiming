import {
  allLeaderboardColumnKeysForUrl,
  defaultExcludedLeaderboardColumns,
} from "@/lib/leaderboardColumns"

/** Short query keys for shareable filter state (coexist with `event`, `config`). */
export const PARAM_EXC_CLASS = "excClass"
export const PARAM_EXC_PRO = "excPro"
export const PARAM_EXC_COL = "excCol"
export const PARAM_EXC_STATS_CLASS = "excStatsClass"
/**
 * Long, human-friendly alias for {@link PARAM_EXC_STATS_CLASS}. Accepted on
 * parse so the PRD's documented `?statsExcludedClasses=Cup3,V6` URL keeps
 * working; we only ever **emit** the short `excStatsClass` key to stay
 * consistent with the surrounding `excClass` / `excPro` convention.
 */
export const PARAM_EXC_STATS_CLASS_LEGACY = "statsExcludedClasses"
/** Comma-separated whitelist of visible column keys (overrides `excCol` when present). */
export const PARAM_COLS = "cols"

export type FilterUrlState = {
  excludedClasses: Set<string>
  excludedProams: Set<string>
  excludedColumns: Set<string>
  excludedStatsClasses: Set<string>
}

export function splitCommaParam(value: string | null): string[] {
  if (!value) {
    return []
  }
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

export function joinCommaSorted(set: Set<string>): string {
  return [...set].sort((a, b) => a.localeCompare(b)).join(",")
}

function excludedClassesFromParams(params: URLSearchParams): Set<string> {
  const merged = params
    .getAll(PARAM_EXC_CLASS)
    .flatMap((v) => splitCommaParam(v))
  return new Set(merged)
}

function excludedProamsFromParams(params: URLSearchParams): Set<string> {
  const merged = params.getAll(PARAM_EXC_PRO).flatMap((v) => splitCommaParam(v))
  return new Set(merged)
}

function excludedStatsClassesFromParams(params: URLSearchParams): Set<string> {
  const merged = [
    ...params.getAll(PARAM_EXC_STATS_CLASS),
    ...params.getAll(PARAM_EXC_STATS_CLASS_LEGACY),
  ].flatMap((v) => splitCommaParam(v))
  return new Set(merged)
}

function excludedColumnsFromParams(params: URLSearchParams): Set<string> {
  const merged = params
    .getAll(PARAM_EXC_COL)
    .flatMap((v) => splitCommaParam(v).map((k) => k.toLowerCase()))
  return new Set(merged)
}

function defaultVisibleColumnSet(): Set<string> {
  const all = allLeaderboardColumnKeysForUrl()
  const ex = defaultExcludedLeaderboardColumns()
  return new Set(all.filter((k) => !ex.has(k)))
}

function excludedColumnsFromColsParam(params: URLSearchParams): Set<string> | null {
  if (!params.has(PARAM_COLS)) {
    return null
  }
  const raw = params.get(PARAM_COLS)
  const visible = new Set(
    splitCommaParam(raw).map((k) => k.toLowerCase())
  )
  const all = allLeaderboardColumnKeysForUrl()
  const excluded = new Set<string>()
  for (const k of all) {
    if (!visible.has(k)) {
      excluded.add(k)
    }
  }
  return excluded
}

function excludedColumnsResolved(params: URLSearchParams): Set<string> {
  const fromCols = excludedColumnsFromColsParam(params)
  if (fromCols !== null) {
    return fromCols
  }
  if (params.has(PARAM_EXC_COL)) {
    return excludedColumnsFromParams(params)
  }
  return defaultExcludedLeaderboardColumns()
}

export function parseFilterParamsFromSearch(search: string): FilterUrlState {
  const q = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(q)
  return {
    excludedClasses: excludedClassesFromParams(params),
    excludedProams: excludedProamsFromParams(params),
    excludedColumns: excludedColumnsResolved(params),
    excludedStatsClasses: excludedStatsClassesFromParams(params),
  }
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const x of a) {
    if (!b.has(x)) {
      return false
    }
  }
  return true
}

export function filterUrlStateEqual(a: FilterUrlState, b: FilterUrlState): boolean {
  return (
    setsEqual(a.excludedClasses, b.excludedClasses) &&
    setsEqual(a.excludedProams, b.excludedProams) &&
    setsEqual(a.excludedColumns, b.excludedColumns) &&
    setsEqual(a.excludedStatsClasses, b.excludedStatsClasses)
  )
}

function visibleColumnsFromExcluded(excluded: Set<string>): Set<string> {
  const all = allLeaderboardColumnKeysForUrl()
  return new Set(all.filter((k) => !excluded.has(k)))
}

/** Mutates `params`: sets/removes filter keys only. Leaves `event`, `config`, etc. */
export function applyFilterStateToSearchParams(
  params: URLSearchParams,
  state: FilterUrlState
): void {
  const setOrDelete = (key: string, set: Set<string>) => {
    if (set.size === 0) {
      params.delete(key)
    } else {
      params.set(key, joinCommaSorted(set))
    }
  }
  setOrDelete(PARAM_EXC_CLASS, state.excludedClasses)
  setOrDelete(PARAM_EXC_PRO, state.excludedProams)
  setOrDelete(PARAM_EXC_STATS_CLASS, state.excludedStatsClasses)
  // The long alias is parse-only; never emit it so we don't end up with both keys.
  params.delete(PARAM_EXC_STATS_CLASS_LEGACY)

  const visible = visibleColumnsFromExcluded(state.excludedColumns)
  const defaultVisible = defaultVisibleColumnSet()
  if (setsEqual(visible, defaultVisible)) {
    params.delete(PARAM_COLS)
    params.delete(PARAM_EXC_COL)
  } else {
    params.set(PARAM_COLS, joinCommaSorted(visible))
    params.delete(PARAM_EXC_COL)
  }
}

/** Returns full `?a=b` search string (or `""` when no params remain). */
export function searchWithUpdatedFilters(currentSearch: string, state: FilterUrlState): string {
  const q = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(q)
  applyFilterStateToSearchParams(params, state)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
