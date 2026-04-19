/**
 * StatsClassFilter — horizontal chip bar of all classes present in PID 9002.
 *
 * Story: PRD-statistics-cockpit.md §"Class filter" item 1.
 *
 * The chip bar derives the available classes from
 * `LEADING ∪ BESTLAPS ∪ BESTSECTORS` via {@link availableStatClasses}, which
 * already drops the synthetic `TOTAL` row and sorts alphabetically. State is
 * the new `excludedStatsClasses` slice on `useFilterStore`; toggling a chip
 * adds / removes its class label from that set. Excluded chips render with
 * `line-through opacity-60` so the active state is "kept", not "selected".
 *
 * On viewports below `lg` the chip row is wrapped in a fade-masked
 * `overflow-x-auto` container (no-scrollbar utility + `mask-image` gradient)
 * so that overflowing chips are discoverable via horizontal scroll without
 * consuming vertical space (PRD "Class filter" item 4).
 *
 * Out of scope (deferred to follow-up stories):
 *   - Wiring chart / heatmap / leading table to read this slice
 */
import { memo, useMemo } from "react"

import { useI18n } from "@/i18n/I18nContext"
import { availableStatClasses } from "@/lib/statistics"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

const CHIP_BASE =
  "px-3 py-1 rounded-sm text-[10px] font-headline uppercase tracking-widest transition-colors focus-ring"

const CHIP_INACTIVE = `${CHIP_BASE} bg-surface-container-low text-zinc-400 hover:text-on-surface hover:bg-surface-container`

const CHIP_EXCLUDED = `${CHIP_BASE} bg-primary-container/20 text-primary line-through opacity-60`

export const StatsClassFilter = memo(function StatsClassFilter() {
  const stats = useLiveStore((s) => s.statistics)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const toggle = useFilterStore((s) => s.toggleExcludedStatsClass)
  const clearAll = useFilterStore((s) => s.clearExcludedStatsClasses)
  const { t } = useI18n()

  const classes = useMemo(() => availableStatClasses(stats), [stats])

  if (classes.length === 0) {
    return null
  }

  const toggleAria = t("stats.classFilter.toggleAria")

  return (
    <section
      data-testid="stats-class-filter"
      className="relative"
      aria-label={t("stats.classFilter.ariaLabel")}
    >
      <div
        data-testid="stats-class-filter-row"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] lg:[mask-image:none] pr-8 lg:pr-0"
      >
        <span className="text-[10px] font-headline uppercase tracking-widest text-zinc-500 shrink-0">
          {t("stats.classFilter.label")}
        </span>
        {classes.map((cls) => {
          const isExcluded = excluded.has(cls)
          return (
            <button
              key={cls}
              type="button"
              role="switch"
              aria-checked={!isExcluded}
              aria-label={`${toggleAria}: ${cls}`}
              onClick={() => toggle(cls)}
              className={isExcluded ? CHIP_EXCLUDED : CHIP_INACTIVE}
            >
              {cls}
            </button>
          )
        })}
        {excluded.size > 0 ? (
          <button
            type="button"
            onClick={() => clearAll()}
            className="text-zinc-500 hover:text-on-surface text-[10px] font-headline uppercase tracking-widest underline-offset-2 hover:underline ml-auto shrink-0 px-2 py-1 transition-colors focus-ring"
            data-testid="stats-class-filter-reset"
            aria-label={t("stats.classFilter.resetAria")}
          >
            {t("stats.classFilter.reset")}
          </button>
        ) : null}
      </div>
    </section>
  )
})
