/**
 * BestLapPerClassChart — horizontal bar chart of best lap, grouped by class,
 * car or team via an internal tab strip.
 *
 * Story: PRD-statistics-cockpit.md §"Best-lap-per-class" item 1, extended in
 * Apr 2026 with the per-car and per-team groupings (see follow-up request).
 *
 * Tab dimensions:
 * - "class": one row per class, sorted by class-best lap (legacy default).
 * - "car":   one row per car number, sorted by car-best lap.
 * - "team":  one row per PID 0 RESULT.TEAM, sorted by team-best lap. Requires
 *            a `sessionMeta` snapshot — without it the tab renders empty.
 *
 * Plain Tailwind DOM per Stitch Fidelity Contract rule F7 (no Recharts, no
 * SVG): each row is a `<div>` with a `<div class="h-2 bg-zinc-900">` track
 * and a `<div class="h-full bg-red-600/{stop}" style={{ width: ...% }}>` fill.
 *
 * The width is set via inline style instead of an arbitrary Tailwind class
 * (`w-[X%]`) because Tailwind 4's JIT cannot statically know every possible
 * percentage; inline style is the canonical workaround and stays pixel-faithful
 * to the Stitch markup.
 *
 * The five colour classes (`bg-red-600`, `bg-red-600/80`, `bg-red-600/60`,
 * `bg-red-600/40`, `bg-red-600/20`) are picked from a static map so PurgeCSS /
 * the JIT compiler sees every literal token.
 *
 * Per-row hover tooltip (PRD best-lap-per-class story 5): we use the native
 * HTML `title=` attribute plus a matching `aria-label=` on each `<li>`.
 * The PRD originally called for the "existing shadcn `<Tooltip>`", but no
 * shadcn / Radix Tooltip primitive exists in this codebase and Stitch itself
 * uses no tooltip library for the bar rows. The native attributes are
 * dependency-free, screen-reader accessible, and stay consistent with rule F4
 * of the Stitch Fidelity Contract (which already uses `title="Kommt in v2"`
 * for disabled sub-tabs).
 *
 * Mobile top-5 expander (PRD best-lap-per-class story 6): on the mobile
 * breakpoint, when there are more than 5 rows we render only the first 5 and
 * a "Mehr anzeigen ↓" button (Stitch `stats-cockpit-mobile.html` line 283).
 * The button vanishes once expanded — Stitch shows no collapse counterpart
 * and re-collapsing mid-scroll would surprise the user. Expansion state is a
 * trivial `useState(false)` per component instance and is **shared across
 * tab switches** — switching tabs simply re-applies the same expanded flag
 * to the new dimension, so users who hit "Mehr anzeigen" once stay expanded
 * when they pivot from class to car to team. Resetting on every tab switch
 * would feel like a regression.
 *
 * Colour palette: Stitch's mobile bars use `bg-primary-container` /
 * `bg-outline-variant`, while the desktop bars use the red opacity ramp
 * (`bg-red-600` → `/20`). Spec rule F7 locks the red ramp for the bar chart;
 * we keep that single palette across breakpoints to avoid colour drift on
 * the same data between viewports. The mobile palette in Stitch is treated
 * as an artistic variant, not a binding rule.
 *
 * Component name kept (`BestLapPerClassChart`) for import-stability across
 * the test suite and StatsTabSection — the visible behaviour is now broader
 * but the file only ever drives one card on the page.
 */
import { useMemo, useState } from "react"

import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useI18n } from "@/i18n/I18nContext"
import {
  bestLapsByCar,
  bestLapsByClass,
  bestLapsByTeam,
  type BestLapBarRow,
  type BestLapOpacityStop,
} from "@/lib/statistics"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

const MOBILE_TOP_N = 5

const OPACITY_CLASS: Record<BestLapOpacityStop, string> = {
  100: "bg-red-600",
  80: "bg-red-600/80",
  60: "bg-red-600/60",
  40: "bg-red-600/40",
  20: "bg-red-600/20",
}

type Dimension = "class" | "car" | "team"

const DIMENSIONS: ReadonlyArray<Dimension> = ["class", "car", "team"]

/**
 * Compose the per-row tooltip text shown via native `title=` and `aria-label=`.
 * Format: `PrimaryLabel · LapTime[ · DayTime][ · DetailText]`.
 * Optional fragments are skipped when null so we never render dangling
 * separators.
 */
function buildTooltipText(row: BestLapBarRow): string {
  const parts: string[] = [row.primaryLabel, row.display]
  if (row.dayTime) parts.push(row.dayTime)
  if (row.detailText) parts.push(row.detailText)
  return parts.join(" · ")
}

function titleKeyFor(dimension: Dimension, mobileTruncated: boolean): string {
  if (mobileTruncated) {
    if (dimension === "car") return "stats.bestLap.titleMobileTop5.car"
    if (dimension === "team") return "stats.bestLap.titleMobileTop5.team"
    return "stats.bestLap.titleMobileTop5"
  }
  if (dimension === "car") return "stats.bestLap.title.car"
  if (dimension === "team") return "stats.bestLap.title.team"
  return "stats.bestLap.title"
}

function ariaLabelKeyFor(dimension: Dimension): string {
  if (dimension === "car") return "stats.bestLap.ariaLabel.car"
  if (dimension === "team") return "stats.bestLap.ariaLabel.team"
  return "stats.bestLap.ariaLabel"
}

function emptyKeyFor(dimension: Dimension): string {
  if (dimension === "team") return "stats.bestLap.empty.team"
  return "stats.bestLap.empty"
}

function tabLabelKeyFor(dimension: Dimension): string {
  if (dimension === "car") return "stats.bestLap.tabs.car"
  if (dimension === "team") return "stats.bestLap.tabs.team"
  return "stats.bestLap.tabs.class"
}

export function BestLapPerClassChart() {
  const stats = useLiveStore((s) => s.statistics)
  const snapshot = useLiveStore((s) => s.sessionMeta)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const { t } = useI18n()
  const bp = useBreakpoint()
  const [expanded, setExpanded] = useState(false)
  const [dimension, setDimension] = useState<Dimension>("class")

  const allRows = useMemo<BestLapBarRow[]>(() => {
    switch (dimension) {
      case "car":
        return bestLapsByCar(stats, excluded, snapshot)
      case "team":
        return bestLapsByTeam(stats, excluded, snapshot)
      case "class":
      default:
        return bestLapsByClass(stats, excluded, snapshot)
    }
  }, [dimension, stats, excluded, snapshot])

  const isMobile = bp === "mobile"
  const isTruncated = isMobile && allRows.length > MOBILE_TOP_N && !expanded
  const rows = isTruncated ? allRows.slice(0, MOBILE_TOP_N) : allRows

  return (
    <section
      data-testid="best-lap-per-class-chart"
      data-dimension={dimension}
      className="bg-surface-container-low p-4 lg:p-6"
      aria-label={t(ariaLabelKeyFor(dimension))}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
          {t(titleKeyFor(dimension, isTruncated))}
        </h3>
        <div
          role="tablist"
          aria-label={t("stats.bestLap.tabs.ariaLabel")}
          data-testid="best-lap-tabs"
          className="inline-flex self-start sm:self-auto rounded-md bg-zinc-900/60 p-0.5 text-[10px] uppercase font-bold tracking-widest"
        >
          {DIMENSIONS.map((dim) => {
            const isActive = dim === dimension
            return (
              <button
                key={dim}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`best-lap-tab-${dim}`}
                onClick={() => setDimension(dim)}
                className={[
                  "px-3 py-1.5 transition-colors rounded-[5px] focus-ring",
                  isActive
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                {t(tabLabelKeyFor(dim))}
              </button>
            )
          })}
        </div>
      </header>
      {allRows.length === 0 ? (
        <p className="text-zinc-500 text-xs italic">
          {t(emptyKeyFor(dimension))}
        </p>
      ) : (
        <ol className="space-y-2 list-none p-0">
          {rows.map((row) => {
            const tooltipText = buildTooltipText(row)
            const rowKey = `${dimension}:${row.primaryLabel}:${row.carNumber}`
            return (
              <li
                key={rowKey}
                className="space-y-1"
                title={tooltipText}
                aria-label={tooltipText}
              >
                <div className="flex min-w-0 justify-between items-baseline gap-2">
                  <div className="min-w-0 flex-1 truncate text-[10px] leading-tight">
                    <span className="uppercase font-bold tracking-widest text-on-surface">
                      {row.primaryLabel}
                    </span>
                    {row.detailText ? (
                      <>
                        <span className="text-on-surface/60" aria-hidden>
                          {" "}
                          ·{" "}
                        </span>
                        <span className="text-on-surface">{row.detailText}</span>
                      </>
                    ) : null}
                  </div>
                  {/* Explicit space so textContent / SR don't glue label to lap time */}
                  {" "}
                  <span className="shrink-0 font-mono tabular-nums text-xs lg:text-sm font-bold text-on-surface">
                    {row.display}
                  </span>
                </div>
                <div
                  className="h-2 bg-zinc-900 overflow-hidden"
                  role="presentation"
                >
                  <div
                    data-testid="best-lap-bar-fill"
                    className={`h-full ${OPACITY_CLASS[row.opacityStop]}`}
                    style={{ width: `${row.widthPct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {isTruncated ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          data-testid="best-lap-expand"
          className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-primary-container hover:bg-primary-container/5 transition-colors focus-ring"
        >
          {t("stats.bestLap.expand")}
        </button>
      ) : null}
    </section>
  )
}
