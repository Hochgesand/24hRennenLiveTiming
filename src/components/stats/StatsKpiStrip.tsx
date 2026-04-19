/**
 * StatsKpiStrip — four-card hero band for the Statistik tab.
 *
 * Numeric formatting contract (PRD §"KPI strip" item 5):
 *   - All lap-time / sector values use formatLapSeconds() from src/lib/lapTimes.ts
 *   - All deltas use formatDeltaSeconds() from src/lib/statistics.ts (sign-aware)
 *   - All numeric value cells render with the `font-mono` class so columns align
 *     with the rest of the dashboard (JetBrains Mono, tabular-nums via the font itself)
 *   - Missing data → em-dash "—" (U+2014), never the ASCII hyphen
 */
import { memo, useMemo } from "react"

import { useI18n } from "@/i18n/I18nContext"
import { formatLapSeconds } from "@/lib/lapTimes"
import { classKpis, formatDeltaSeconds } from "@/lib/statistics"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

export type KpiAccent = "primary" | "secondary" | "tertiary" | "outline"

export type KpiCardProps = {
  caption: string
  value: string
  sub?: string
  accent: KpiAccent
  valueClassName?: string
  subClassName?: string
}

const BORDER_BY_ACCENT: Record<KpiAccent, string> = {
  primary: "border-primary-container",
  secondary: "border-secondary-container",
  tertiary: "border-tertiary-container",
  outline: "border-outline-variant/30",
}

export function KpiCard({
  caption,
  value,
  sub,
  accent,
  valueClassName,
  subClassName,
}: KpiCardProps) {
  const borderClass = BORDER_BY_ACCENT[accent]
  const valueColour = valueClassName ?? "text-on-surface"
  const subColour = subClassName ?? "text-primary"

  return (
    <div
      data-testid="kpi-card"
      className={`bg-surface-container-low p-3 lg:p-4 border-l-2 ${borderClass}`}
    >
      <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1 lg:mb-2">
        {caption}
      </div>
      <div className={`font-mono tabular-nums text-lg lg:text-3xl font-bold ${valueColour}`}>
        {value}
      </div>
      {sub ? (
        <div className={`text-[10px] lg:text-xs ${subColour} mt-1`}>{sub}</div>
      ) : null}
    </div>
  )
}

export const StatsKpiStrip = memo(function StatsKpiStrip() {
  const stats = useLiveStore((s) => s.statistics)
  const excluded = useFilterStore((s) => s.excludedStatsClasses)
  const { t } = useI18n()
  const kpis = useMemo(() => classKpis(stats, excluded), [stats, excluded])
  const isSkeleton = stats === null

  const skeletonSub = t("stats.kpi.skeleton.waiting")
  const fastestSub = isSkeleton
    ? skeletonSub
    : kpis.fastestLap
      ? `#${kpis.fastestLap.carNumber} · ${kpis.fastestLap.classLabel}`
      : t("stats.kpi.fastestLap.noData")

  return (
    <section
      data-state={isSkeleton ? "skeleton" : "ready"}
      className={`grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4${isSkeleton ? " animate-pulse opacity-80" : ""}`}
      aria-label={t("stats.kpi.ariaLabel")}
    >
      <KpiCard
        caption={t("stats.kpi.fastestLap.caption")}
        value={kpis.fastestLap?.display ?? "—"}
        sub={fastestSub}
        accent="primary"
      />
      <KpiCard
        caption={t("stats.kpi.theoreticalBest.caption")}
        value={
          kpis.theoreticalBestSeconds !== null
            ? formatLapSeconds(kpis.theoreticalBestSeconds)
            : "—"
        }
        sub={t("stats.kpi.theoreticalBest.sub")}
        accent="outline"
      />
      <KpiCard
        caption={t("stats.kpi.delta.caption")}
        value={
          kpis.deltaSeconds !== null
            ? formatDeltaSeconds(kpis.deltaSeconds)
            : "—"
        }
        sub={t("stats.kpi.delta.sub")}
        accent="secondary"
        valueClassName="text-secondary"
        subClassName="text-secondary/80"
      />
      <KpiCard
        caption={t("stats.kpi.activeClasses.caption")}
        value={isSkeleton ? "—" : String(kpis.activeClasses)}
        sub={
          isSkeleton
            ? skeletonSub
            : kpis.leadingCount > 0
              ? `${kpis.leadingCount} ${t("stats.kpi.activeClasses.subSuffix")}`
              : t("stats.kpi.activeClasses.noData")
        }
        accent="tertiary"
        subClassName="text-tertiary"
      />
    </section>
  )
})
