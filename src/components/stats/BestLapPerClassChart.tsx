/**
 * BestLapPerClassChart — horizontal bar chart of best lap per racing class.
 *
 * Story: PRD-statistics-cockpit.md §"Best-lap-per-class" item 1.
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
 * trivial `useState(false)` per component instance: we deliberately do NOT
 * reset it on filter changes, since users frequently toggle the class chips
 * while the expanded view is what they want to see.
 *
 * Colour palette: Stitch's mobile bars use `bg-primary-container` /
 * `bg-outline-variant`, while the desktop bars use the red opacity ramp
 * (`bg-red-600` → `/20`). Spec rule F7 locks the red ramp for the bar chart;
 * we keep that single palette across breakpoints to avoid colour drift on
 * the same data between viewports. The mobile palette in Stitch is treated
 * as an artistic variant, not a binding rule.
 *
 * Out of scope (deferred to follow-up stories under §"Best-lap-per-class"):
 *   - The 60/40 grid wrapper with the heatmap (lands with the heatmap stories)
 */
import { memo, useMemo, useState } from "react"

import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useI18n } from "@/i18n/I18nContext"
import {
  bestLapsByClass,
  type BestLapByClassRow,
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

/**
 * Compose the per-row tooltip text shown via native `title=` and `aria-label=`.
 * Format: `Class · #NR · LapTime[ · DayTime][ · Driver / Team]`.
 * Optional fragments are skipped when null so we never render dangling
 * separators.
 */
function buildTooltipText(row: BestLapByClassRow): string {
  const parts: string[] = [
    row.classLabel,
    `#${row.carNumber}`,
    row.display,
  ]
  if (row.dayTime) parts.push(row.dayTime)
  if (row.driverTeam) parts.push(row.driverTeam)
  return parts.join(" · ")
}

export const BestLapPerClassChart = memo(function BestLapPerClassChart() {
  const stats = useLiveStore((s) => s.statistics)
  const snapshot = useLiveStore((s) => s.sessionMeta)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const { t } = useI18n()
  const bp = useBreakpoint()
  const [expanded, setExpanded] = useState(false)

  const allRows = useMemo(
    () => bestLapsByClass(stats, excluded, snapshot),
    [stats, excluded, snapshot]
  )

  const isMobile = bp === "mobile"
  const isTruncated = isMobile && allRows.length > MOBILE_TOP_N && !expanded
  const rows = isTruncated ? allRows.slice(0, MOBILE_TOP_N) : allRows

  return (
    <section
      data-testid="best-lap-per-class-chart"
      className="bg-surface-container-low p-4 lg:p-6"
      aria-label={t("stats.bestLap.ariaLabel")}
    >
      <header className="mb-4">
        <h3 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
          {isTruncated
            ? t("stats.bestLap.titleMobileTop5")
            : t("stats.bestLap.title")}
        </h3>
      </header>
      {allRows.length === 0 ? (
        <p className="text-zinc-500 text-xs italic">
          {t("stats.bestLap.empty")}
        </p>
      ) : (
        <ol className="space-y-2 list-none p-0">
          {rows.map((row) => {
            const tooltipText = buildTooltipText(row)
            return (
              <li
                key={row.classLabel}
                className="space-y-1"
                title={tooltipText}
                aria-label={tooltipText}
              >
                <div className="flex min-w-0 justify-between items-baseline gap-2">
                  <div className="min-w-0 flex-1 truncate text-[10px] leading-tight">
                    <span className="uppercase font-bold tracking-widest text-on-surface">
                      {row.classLabel}
                    </span>
                    <span className="text-on-surface/60" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-400 text-xs">
                      #{row.carNumber}
                    </span>
                    {row.driverTeam ? (
                      <>
                        <span className="text-on-surface/60" aria-hidden>
                          {" "}
                          ·{" "}
                        </span>
                        <span className="text-on-surface">{row.driverTeam}</span>
                      </>
                    ) : null}
                  </div>
                  {/* Explicit space so textContent / SR don't glue #NR to lap time */}
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
})
