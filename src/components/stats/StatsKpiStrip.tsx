import { useMemo } from "react"

import { useI18n } from "@/i18n/I18nContext"
import { classKpis } from "@/lib/statistics"
import { useLiveStore } from "@/store/useLiveStore"

export type KpiAccent = "primary" | "secondary" | "tertiary" | "outline"

export type KpiCardProps = {
  caption: string
  value: string
  sub?: string
  accent: KpiAccent
}

const BORDER_BY_ACCENT: Record<KpiAccent, string> = {
  primary: "border-primary-container",
  secondary: "border-secondary-container",
  tertiary: "border-tertiary-container",
  outline: "border-outline-variant/30",
}

export function KpiCard({ caption, value, sub, accent }: KpiCardProps) {
  const borderClass = BORDER_BY_ACCENT[accent]

  return (
    <div
      className={`bg-surface-container-low p-3 lg:p-4 border-l-2 ${borderClass}`}
    >
      <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1 lg:mb-2">
        {caption}
      </div>
      <div className="font-mono text-lg lg:text-3xl font-bold text-on-surface">
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] lg:text-xs text-primary mt-1">{sub}</div>
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
      {/* Slots for upcoming KPI cards (theoretical best, delta, active classes)
          land in stories 2–4 of this band. */}
    </section>
  )
}
