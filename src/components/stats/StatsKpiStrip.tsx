import { useMemo } from "react"

import { useI18n } from "@/i18n/I18nContext"
import { formatLapSeconds } from "@/lib/lapTimes"
import { classKpis, formatDeltaSeconds } from "@/lib/statistics"
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
      <div className={`font-mono text-lg lg:text-3xl font-bold ${valueColour}`}>
        {value}
      </div>
      {sub ? (
        <div className={`text-[10px] lg:text-xs ${subColour} mt-1`}>{sub}</div>
      ) : null}
    </div>
  )
}

export function StatsKpiStrip() {
  const stats = useLiveStore((s) => s.statistics)
  const { t } = useI18n()
  const kpis = useMemo(() => classKpis(stats), [stats])

  const fastestSub = kpis.fastestLap
    ? `#${kpis.fastestLap.carNumber} · ${kpis.fastestLap.classLabel}`
    : t("stats.kpi.fastestLap.noData")

  return (
    <section
      className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4"
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
        value={String(kpis.activeClasses)}
        sub={
          kpis.leadingCount > 0
            ? `${kpis.leadingCount} ${t("stats.kpi.activeClasses.subSuffix")}`
            : t("stats.kpi.activeClasses.noData")
        }
        accent="tertiary"
        subClassName="text-tertiary"
      />
    </section>
  )
}
