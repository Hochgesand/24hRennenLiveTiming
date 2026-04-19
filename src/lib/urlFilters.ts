/** Short query keys for shareable filter state (coexist with `event`, `config`). */
export const PARAM_EXC_CLASS = "excClass"
export const PARAM_EXC_PRO = "excPro"
export const PARAM_EXC_COL = "excCol"

export type FilterUrlState = {
  excludedClasses: Set<string>
  excludedProams: Set<string>
  excludedColumns: Set<string>
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

function excludedColumnsFromParams(params: URLSearchParams): Set<string> {
  const merged = params
    .getAll(PARAM_EXC_COL)
    .flatMap((v) => splitCommaParam(v).map((k) => k.toLowerCase()))
  return new Set(merged)
}

export function parseFilterParamsFromSearch(search: string): FilterUrlState {
  const q = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(q)
  return {
    excludedClasses: excludedClassesFromParams(params),
    excludedProams: excludedProamsFromParams(params),
    excludedColumns: excludedColumnsFromParams(params),
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
    setsEqual(a.excludedColumns, b.excludedColumns)
  )
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
  setOrDelete(PARAM_EXC_COL, state.excludedColumns)
}

/** Returns full `?a=b` search string (or `""` when no params remain). */
export function searchWithUpdatedFilters(currentSearch: string, state: FilterUrlState): string {
  const q = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(q)
  applyFilterStateToSearchParams(params, state)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
