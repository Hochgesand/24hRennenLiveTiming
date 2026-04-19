/**
 * LeadingTable — class-leaders ("Klassen-Führende") table for the Statistik tab.
 *
 * Stories: PRD-statistics-cockpit.md §"Statistik tab — enriched leading table"
 * items 1, 2, 3, 5, 6 (item 4 — sortable headers — is a separate story).
 *
 * Driven by {@link enrichedLeading}, which joins `PID 9002.LEADING` with
 * `PID 0.RESULT.STNR` and applies the shared `excludedStatsClasses` filter.
 *
 * Two render variants by {@link useBreakpoint}:
 *
 * - **Desktop / tablet** (`bp !== "mobile"`): mirrors `stats-cockpit-desktop.html`
 *   lines 340–429. Sticky `<thead>` (story 5; Stitch's static page does not show
 *   it but rule F9 + the spec require it). Stitch's reference does not contain
 *   a `seit Runde` column — story 1 does. We append it as the 7th
 *   `text-right` column; the rest of the markup stays cell-for-cell faithful.
 *   The `#NR` cell is a `<button>` so the click handler opens the existing
 *   `<CarDrilldownDialog>` (mounted globally in `App.tsx`) via
 *   `useUiStore.setSelectedStartingNo` (story 3).
 *
 * - **Mobile** (`bp === "mobile"`): mirrors `stats-cockpit-mobile.html` lines
 *   285–326 (story 6). Each row is a `<button>` so the entire card is the
 *   drilldown handle. The Stitch reference renders three lines per card
 *   (`KLS · RUNDE N` / `+gap` / `#NR TEAM` / `Driver`) but the WIGE wire
 *   produces a single combined `Driver / Team` string via `composeDriverTeam`,
 *   so we collapse to two lines: `KLS · RUNDE N · GAP` (mono) and
 *   `#NR Driver/Team` (truncated). Documented spec deviation, source-data
 *   driven.
 *
 * Both variants annotate each row with `data-testid="leading-row"`,
 * `data-class` and `data-nr` so the upcoming heatmap → leading-table
 * scroll-and-highlight (heatmap story 25) can target rows without being
 * coupled to this component's internals.
 */
import { useMemo, useState } from "react"

import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useI18n } from "@/i18n/I18nContext"
import { enrichedLeading, type EnrichedLeadingRow } from "@/lib/statistics"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

const EM_DASH = "—"

/** Sortable column keys for the desktop leading table. */
type LeadingSortKey = "class" | "laps" | "gap" | "sum"
type SortDir = "asc" | "desc"
/** `null` means "wire order" (unsorted), the default. */
type SortState = { key: LeadingSortKey; dir: SortDir } | null

/**
 * Default sort = no sort. The table renders rows in the order PID 9002 wire
 * delivers them (leader of each class, in class order). This mirrors the
 * pre-sort behaviour and is what the unit tests for items 1-3+5+6 assert.
 */
const DEFAULT_SORT: SortState = null

/**
 * Three-state cycle for clicking a sortable header:
 *
 * - inactive → `{ key, dir: "asc" }`
 * - active asc → `{ key, dir: "desc" }`
 * - active desc → `null` (back to wire order)
 *
 * Single sort key at a time: clicking a different header always starts a new
 * cycle on that header at `asc`.
 */
function nextSort(prev: SortState, key: LeadingSortKey): SortState {
  if (prev === null || prev.key !== key) return { key, dir: "asc" }
  if (prev.dir === "asc") return { key, dir: "desc" }
  return null
}

const GAP_NUMERIC_RE = /^[+-]?\d+(?:\.\d+)?/

/**
 * Decorate a row with `(pinFirst, missing, value)` for the active sort key.
 *
 * - `pinFirst` rows always sort to the TOP regardless of direction. Today
 *   this is used only by `gap`, where leaders are always shown first.
 * - `missing` rows always sort to the END regardless of direction (stable
 *   "missing last"): `laps === null`, `sumDisplay === "—"`.
 * - `value` is the per-key sortable representation:
 *   - "class" → `classLabel` string (locale-aware numeric compare).
 *   - "laps"  → numeric lap count.
 *   - "gap"   → parsed leading number from the gap display (`+2 Laps` → 2,
 *               `+1.234` → 1.234). Unparseable → `+Infinity` so it sorts
 *               last among non-leader, non-missing rows.
 *   - "sum"   → `sumDisplay` string (`HH:MM:SS.mmm`-ish; lexicographic +
 *               numeric does the right thing for same-length strings).
 */
type SortKey = {
  pinFirst: boolean
  missing: boolean
  value: string | number
}

function sortKeyFor(row: EnrichedLeadingRow, key: LeadingSortKey): SortKey {
  switch (key) {
    case "class":
      return { pinFirst: false, missing: false, value: row.classLabel }
    case "laps":
      return row.laps === null
        ? { pinFirst: false, missing: true, value: 0 }
        : { pinFirst: false, missing: false, value: row.laps }
    case "gap": {
      if (row.isLeader) return { pinFirst: true, missing: false, value: 0 }
      const m = GAP_NUMERIC_RE.exec(row.gap)
      if (!m) return { pinFirst: false, missing: false, value: Infinity }
      return { pinFirst: false, missing: false, value: Number.parseFloat(m[0]) }
    }
    case "sum":
      if (row.sumDisplay === EM_DASH || row.sumDisplay === "")
        return { pinFirst: false, missing: true, value: "" }
      return { pinFirst: false, missing: false, value: row.sumDisplay }
  }
}

function compareValues(a: SortKey["value"], b: SortKey["value"]): number {
  if (typeof a === "number" && typeof b === "number") {
    if (a === b) return 0
    return a < b ? -1 : 1
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

/**
 * Pure comparator-based sort. Returns a new array; the input is not mutated.
 *
 * Invariants:
 * - `sort === null` → identity (preserve wire order).
 * - Missing values (`laps === null`, `sumDisplay === "—"`) always end up at
 *   the bottom regardless of `dir` — the missing flag is checked before the
 *   sign multiplication.
 * - Leader rows sort to the top of `gap` for both asc and desc (their sort
 *   value is `-Infinity`).
 */
function sortLeadingRows(
  rows: EnrichedLeadingRow[],
  sort: SortState
): EnrichedLeadingRow[] {
  if (sort === null) return rows
  const sign = sort.dir === "asc" ? 1 : -1
  const decorated = rows.map((row) => ({ row, sk: sortKeyFor(row, sort.key) }))
  decorated.sort((a, b) => {
    if (a.sk.pinFirst !== b.sk.pinFirst) return a.sk.pinFirst ? -1 : 1
    if (a.sk.missing !== b.sk.missing) return a.sk.missing ? 1 : -1
    if (a.sk.missing && b.sk.missing) return 0
    return sign * compareValues(a.sk.value, b.sk.value)
  })
  return decorated.map((d) => d.row)
}

function ariaSortFor(
  sort: SortState,
  key: LeadingSortKey
): "ascending" | "descending" | "none" {
  if (sort === null || sort.key !== key) return "none"
  return sort.dir === "asc" ? "ascending" : "descending"
}

function SortIndicator({
  sort,
  keyName,
}: {
  sort: SortState
  keyName: LeadingSortKey
}) {
  if (sort?.key === keyName) {
    return (
      <span
        className="material-symbols-outlined text-on-surface text-[14px]"
        aria-hidden="true"
      >
        {sort.dir === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
    )
  }
  return (
    <span
      className="material-symbols-outlined text-zinc-700 text-[14px]"
      aria-hidden="true"
    >
      unfold_more
    </span>
  )
}

export function LeadingTable() {
  const stats = useLiveStore((s) => s.statistics)
  const snapshot = useLiveStore((s) => s.sessionMeta)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const setSelectedStartingNo = useUiStore((s) => s.setSelectedStartingNo)
  const { t } = useI18n()
  const bp = useBreakpoint()
  /**
   * Sort state is intentionally local React state, not URL-persisted and not
   * stored in any global store: sortable order is an ephemeral exploration
   * affordance, not a shareable view. Resets on unmount (leaving the Stats
   * tab returns to wire order). Mobile keeps wire order regardless of this
   * value because the mobile card variant has no header row to click.
   */
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const cycleSort = (key: LeadingSortKey): void => {
    setSort((prev) => nextSort(prev, key))
  }

  const data = useMemo(
    () => enrichedLeading(stats, snapshot, excluded),
    [stats, snapshot, excluded]
  )

  const isMobile = bp === "mobile"

  const sortedRows = useMemo(
    () => (isMobile ? data.rows : sortLeadingRows(data.rows, sort)),
    [data.rows, sort, isMobile]
  )

  const openDrilldown = (carNumber: string): void => {
    if (carNumber === EM_DASH) return
    setSelectedStartingNo(carNumber)
  }

  if (isMobile) {
    return (
      <section
        data-testid="leading-table"
        data-variant="mobile"
        className="space-y-3 pb-4"
        aria-label={t("stats.leading.ariaLabel")}
      >
        <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-gray-400">
          {t("stats.leading.title")}
        </h2>
        {data.rows.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">
            {t("stats.leading.empty")}
          </p>
        ) : (
          <ul className="space-y-1 list-none p-0">
            {data.rows.map((row, i) => {
              const disabled = row.carNumber === EM_DASH
              const lapTag =
                row.fromLap !== null
                  ? ` · ${t("stats.leading.lapShort")} ${row.fromLap}`
                  : ""
              const driverSuffix = row.driverTeam ? ` ${row.driverTeam}` : ""
              const aria = `${t("stats.leading.openDrilldownAria")}: #${row.carNumber} ${row.classLabel}`
              return (
                <li key={`${row.classLabel}-${row.carNumber}-${i}`}>
                  <button
                    type="button"
                    onClick={() => openDrilldown(row.carNumber)}
                    data-testid="leading-row"
                    data-class={row.classLabel}
                    data-nr={row.carNumber}
                    aria-label={aria}
                    disabled={disabled}
                    className="w-full text-left flex items-center bg-surface-container-low p-3 border-l-2 border-primary-container group disabled:opacity-50"
                  >
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[10px] font-bold text-primary-container uppercase">
                          {row.classLabel}
                          {lapTag}
                        </span>
                        <span
                          className={`text-[10px] font-mono ${row.isLeader ? "text-secondary" : "text-gray-400"}`}
                        >
                          {row.gap}
                        </span>
                      </div>
                      <div className="text-xs font-bold uppercase truncate">
                        #{row.carNumber}
                        {driverSuffix}
                      </div>
                    </div>
                    <span
                      className="material-symbols-outlined text-gray-700 group-hover:text-primary transition-colors ml-2"
                      data-icon="chevron_right"
                      aria-hidden="true"
                    >
                      chevron_right
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    )
  }

  return (
    <section
      data-testid="leading-table"
      data-variant="desktop"
      className="bg-surface-container-low overflow-hidden"
      aria-label={t("stats.leading.ariaLabel")}
    >
      <header className="p-6 flex justify-between items-center bg-surface-container-high/30">
        <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-zinc-300">
          {t("stats.leading.title")}
        </h3>
      </header>
      {data.rows.length === 0 ? (
        <p className="px-6 pb-6 text-zinc-500 text-xs italic">
          {t("stats.leading.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-headline font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50">
                <th
                  className="px-6 py-4"
                  scope="col"
                  aria-sort={ariaSortFor(sort, "class")}
                >
                  <button
                    type="button"
                    onClick={() => cycleSort("class")}
                    data-testid="leading-sort-class"
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-on-surface uppercase tracking-widest font-headline font-bold text-[10px]"
                    aria-label={`${t("stats.leading.sortAria")}: ${t("stats.leading.colClass")}`}
                  >
                    {t("stats.leading.colClass")}
                    <SortIndicator sort={sort} keyName="class" />
                  </button>
                </th>
                <th className="px-6 py-4" scope="col">
                  #
                </th>
                <th className="px-6 py-4" scope="col">
                  {t("stats.leading.colDriverTeam")}
                </th>
                <th
                  className="px-6 py-4"
                  scope="col"
                  aria-sort={ariaSortFor(sort, "laps")}
                >
                  <button
                    type="button"
                    onClick={() => cycleSort("laps")}
                    data-testid="leading-sort-laps"
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-on-surface uppercase tracking-widest font-headline font-bold text-[10px]"
                    aria-label={`${t("stats.leading.sortAria")}: ${t("stats.leading.colLaps")}`}
                  >
                    {t("stats.leading.colLaps")}
                    <SortIndicator sort={sort} keyName="laps" />
                  </button>
                </th>
                <th
                  className="px-6 py-4"
                  scope="col"
                  aria-sort={ariaSortFor(sort, "gap")}
                >
                  <button
                    type="button"
                    onClick={() => cycleSort("gap")}
                    data-testid="leading-sort-gap"
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-on-surface uppercase tracking-widest font-headline font-bold text-[10px]"
                    aria-label={`${t("stats.leading.sortAria")}: ${t("stats.leading.colGap")}`}
                  >
                    {t("stats.leading.colGap")}
                    <SortIndicator sort={sort} keyName="gap" />
                  </button>
                </th>
                <th
                  className="px-6 py-4 text-right"
                  scope="col"
                  aria-sort={ariaSortFor(sort, "sum")}
                >
                  <button
                    type="button"
                    onClick={() => cycleSort("sum")}
                    data-testid="leading-sort-sum"
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-on-surface uppercase tracking-widest font-headline font-bold text-[10px]"
                    aria-label={`${t("stats.leading.sortAria")}: ${t("stats.leading.colSum")}`}
                  >
                    {t("stats.leading.colSum")}
                    <SortIndicator sort={sort} keyName="sum" />
                  </button>
                </th>
                <th className="px-6 py-4 text-right" scope="col">
                  {t("stats.leading.colFromLap")}
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {sortedRows.map((row, i) => {
                const disabled = row.carNumber === EM_DASH
                const zebra =
                  i % 2 === 0
                    ? "bg-surface-container-lowest/40"
                    : "bg-surface-container-low"
                return (
                  <tr
                    key={`${row.classLabel}-${row.carNumber}-${i}`}
                    data-testid="leading-row"
                    data-class={row.classLabel}
                    data-nr={row.carNumber}
                    className={`${zebra} hover:bg-zinc-800/50 transition-colors`}
                  >
                    <td className="px-6 py-4 text-red-600 font-bold font-headline">
                      {row.classLabel}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <button
                        type="button"
                        onClick={() => openDrilldown(row.carNumber)}
                        data-testid="leading-row-nr"
                        aria-label={`${t("stats.leading.openDrilldownAria")}: #${row.carNumber}`}
                        className="text-zinc-400 hover:text-on-surface underline-offset-2 hover:underline transition-colors disabled:no-underline disabled:cursor-not-allowed"
                        disabled={disabled}
                      >
                        #{row.carNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-headline uppercase font-semibold">
                      {row.driverTeam ?? EM_DASH}
                    </td>
                    <td className="px-6 py-4">{row.laps ?? EM_DASH}</td>
                    <td
                      className={`px-6 py-4 ${row.isLeader ? "text-secondary-container" : "text-zinc-500"}`}
                    >
                      {row.gap}
                    </td>
                    <td className="px-6 py-4 text-right">{row.sumDisplay}</td>
                    <td className="px-6 py-4 text-right">
                      {row.fromLap ?? EM_DASH}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
