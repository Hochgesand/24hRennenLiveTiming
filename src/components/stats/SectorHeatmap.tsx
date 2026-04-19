/**
 * SectorHeatmap — class × sector best-time matrix with red opacity heat shading.
 *
 * Stories: PRD-statistics-cockpit.md §"Statistik tab — sector heatmap" items 1–6.
 *
 * Layout per Stitch Fidelity Contract rule F8:
 * - Plain `<table>` with `border-separate border-spacing-px` (NOT a CSS grid).
 * - Rows = classes (TOTAL pinned to top); Columns = `S1..Sn` (n = dynamic via
 *   {@link sectorHeatmap}'s sectorCount, no hard-coding to 9), plus a final
 *   `LAP` column on the right.
 * - Each `<td>` carries `aria-label` + `title` with the absolute time and the
 *   delta vs. column best so screen readers and pointer hover both surface the
 *   numerical context.
 *
 * Two render variants driven by {@link useBreakpoint}:
 * - **Desktop** (Stitch `stats-cockpit-desktop.html` lines 276–338): red opacity
 *   ramp `bg-red-600/{100..10}` per the documented cutoff scheme on
 *   {@link sectorHeatmap}. Column-best cells get `text-white font-bold` to match
 *   the Stitch `bg-red-600 text-white font-bold` cell.
 * - **Mobile** (Stitch `stats-cockpit-mobile.html` lines 170–232): inline-pill
 *   variant. Stop 100 ⇒ secondary container, 90/80 ⇒ primary, 70/60/50 ⇒
 *   tertiary, ≤40 ⇒ no pill (plain mono text). The first column is sticky
 *   (`sticky left-0 bg-background`) so the class label stays pinned during
 *   horizontal scroll.
 *
 * Both opacity-class records are listed literally so Tailwind 4's JIT detects
 * every token at build time (no dynamic class composition).
 */
import { useMemo } from "react"

import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useI18n } from "@/i18n/I18nContext"
import { formatLapSeconds } from "@/lib/lapTimes"
import {
  sectorHeatmap,
  type SectorHeatmapCell,
  type SectorHeatmapOpacityStop,
} from "@/lib/statistics"
import { scrollToLeadingClass } from "@/lib/uiInteractions"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

const OPACITY_CLASS_DESKTOP: Record<SectorHeatmapOpacityStop, string> = {
  100: "bg-red-600",
  90: "bg-red-600/90",
  80: "bg-red-600/80",
  70: "bg-red-600/70",
  60: "bg-red-600/60",
  50: "bg-red-600/50",
  40: "bg-red-600/40",
  30: "bg-red-600/30",
  20: "bg-red-600/20",
  10: "bg-red-600/10",
}

const MOBILE_PILL_CLASS: Record<SectorHeatmapOpacityStop, string | null> = {
  100: "bg-secondary-container/20 text-secondary",
  90: "bg-primary-container/20 text-primary",
  80: "bg-primary-container/20 text-primary",
  70: "bg-tertiary-container/20 text-tertiary",
  60: "bg-tertiary-container/20 text-tertiary",
  50: "bg-tertiary-container/20 text-tertiary",
  40: null,
  30: null,
  20: null,
  10: null,
}

function pickMobilePillClass(
  stop: SectorHeatmapOpacityStop | null
): string | null {
  if (stop === null) return null
  return MOBILE_PILL_CLASS[stop]
}

/**
 * Build the screen-reader label / native title for a cell.
 *
 * Format examples:
 * - Best:    `SP9 S1: 1:21.200 (Bestzeit)`
 * - Slower:  `CUP2 S1: 1:25.400 · Δ +4.200 s (+5.18 %)`
 * - Empty:   `CUP2 S5: —`
 *
 * `Bestzeit` is intentionally a literal (matches the german UI; the rest of the
 * label is data-driven). It does not need an i18n indirection — the label is a
 * tooltip / aria-label, not visible chrome, and the same string ships in both
 * locales.
 */
function buildCellAria(
  classLabel: string,
  sector: number,
  cell: SectorHeatmapCell
): string {
  if (cell.seconds === null) {
    return `${classLabel} S${sector}: —`
  }
  const time = formatLapSeconds(cell.seconds)
  if (cell.isColumnBest) {
    return `${classLabel} S${sector}: ${time} (Bestzeit)`
  }
  if (cell.deltaSeconds === null || cell.deltaRel === null) {
    return `${classLabel} S${sector}: ${time}`
  }
  const dSec = `+${cell.deltaSeconds.toFixed(3)} s`
  const dPct = `+${(cell.deltaRel * 100).toFixed(2)} %`
  return `${classLabel} S${sector}: ${time} · Δ ${dSec} (${dPct})`
}

export function SectorHeatmap() {
  const stats = useLiveStore((s) => s.statistics)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const { t } = useI18n()
  const bp = useBreakpoint()

  const data = useMemo(() => sectorHeatmap(stats, excluded), [stats, excluded])

  const isMobile = bp === "mobile"

  if (isMobile) {
    return (
      <section
        data-testid="sector-heatmap"
        data-variant="mobile"
        className="space-y-3"
        aria-label={t("stats.heatmap.ariaLabel")}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-headline text-xs font-bold uppercase tracking-widest text-gray-400">
            {t("stats.heatmap.title")}
          </h2>
          <span className="text-[10px] font-mono text-primary animate-pulse">
            {t("stats.heatmap.liveBadge")}
          </span>
        </div>
        {data.rows.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">
            {t("stats.heatmap.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto no-scrollbar -mx-3 px-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[9px] font-bold text-gray-600 uppercase">
                  <th
                    scope="col"
                    className="text-left py-2 sticky left-0 bg-background pr-4"
                  >
                    {t("stats.heatmap.colClassLong")}
                  </th>
                  {Array.from({ length: data.sectorCount }, (_, i) => (
                    <th key={`s${i + 1}`} scope="col" className="px-2 py-2">
                      {`S${i + 1}`}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right">
                    {t("stats.heatmap.colLap")}
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-[10px]">
                {data.rows.map((row) => (
                  <tr
                    key={row.classLabel}
                    className="border-b border-surface-container-high"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 bg-background text-left p-0"
                    >
                      <button
                        type="button"
                        onClick={() => scrollToLeadingClass(row.classLabel)}
                        data-testid="heatmap-class-jump"
                        data-class={row.classLabel}
                        aria-label={`${t("stats.heatmap.jumpToLeading")}: ${row.classLabel}`}
                        className="w-full text-left py-2 pr-4 font-bold text-on-surface hover:text-red-400 transition-colors"
                      >
                        {row.classLabel}
                      </button>
                    </th>
                    {row.cells.map((cell, i) => {
                      const aria = buildCellAria(row.classLabel, i + 1, cell)
                      if (!cell.display) {
                        return (
                          <td
                            key={i}
                            className="px-1 text-center"
                            aria-label={aria}
                          />
                        )
                      }
                      const pillClass = pickMobilePillClass(cell.opacityStop)
                      return (
                        <td
                          key={i}
                          className="px-1 text-center"
                          title={aria}
                          aria-label={aria}
                        >
                          {pillClass ? (
                            <span
                              className={`${pillClass} px-1 rounded-sm`}
                            >
                              {cell.display}
                            </span>
                          ) : (
                            cell.display
                          )}
                        </td>
                      )
                    })}
                    <td
                      className="px-2 py-2 text-right font-bold"
                      aria-label={`${t("stats.heatmap.colLap")}: ${row.lapTimeDisplay || "—"}`}
                    >
                      {row.lapTimeDisplay || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  return (
    <section
      data-testid="sector-heatmap"
      data-variant="desktop"
      className="bg-surface-container-low p-6 overflow-hidden"
      aria-label={t("stats.heatmap.ariaLabel")}
    >
      <header className="flex justify-between items-center mb-6">
        <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-zinc-300">
          {t("stats.heatmap.title")}
        </h3>
        <span
          className="material-symbols-outlined text-zinc-600 text-sm"
          data-icon="grid_on"
          aria-hidden="true"
        >
          grid_on
        </span>
      </header>
      {data.rows.length === 0 ? (
        <p className="text-zinc-500 text-xs italic">
          {t("stats.heatmap.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] uppercase font-headline tracking-tighter border-separate border-spacing-px">
            <thead>
              <tr className="text-zinc-500">
                <th className="pb-2 text-left" scope="col">
                  {t("stats.heatmap.colClass")}
                </th>
                {Array.from({ length: data.sectorCount }, (_, i) => (
                  <th key={`s${i + 1}`} className="pb-2" scope="col">
                    {`S${i + 1}`}
                  </th>
                ))}
                <th className="pb-2" scope="col">
                  {t("stats.heatmap.colLap")}
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-center">
              {data.rows.map((row) => (
                <tr key={row.classLabel}>
                  <th
                    scope="row"
                    className="bg-zinc-900 text-left p-0"
                  >
                    <button
                      type="button"
                      onClick={() => scrollToLeadingClass(row.classLabel)}
                      data-testid="heatmap-class-jump"
                      data-class={row.classLabel}
                      aria-label={`${t("stats.heatmap.jumpToLeading")}: ${row.classLabel}`}
                      className="w-full text-left py-2 pr-2 font-headline font-bold uppercase hover:text-red-400 transition-colors"
                    >
                      {row.classLabel}
                    </button>
                  </th>
                  {row.cells.map((cell, i) => {
                    const aria = buildCellAria(row.classLabel, i + 1, cell)
                    const baseCls =
                      cell.opacityStop === null
                        ? "bg-zinc-900/40 text-zinc-700"
                        : OPACITY_CLASS_DESKTOP[cell.opacityStop]
                    const cls = cell.isColumnBest
                      ? `${baseCls} text-white font-bold`
                      : baseCls
                    return (
                      <td
                        key={i}
                        className={`${cls} py-2`}
                        title={aria}
                        aria-label={aria}
                      >
                        {cell.display || ""}
                      </td>
                    )
                  })}
                  <td
                    className="bg-zinc-800 py-2"
                    aria-label={`${t("stats.heatmap.colLap")}: ${row.lapTimeDisplay || "—"}`}
                  >
                    {row.lapTimeDisplay || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
