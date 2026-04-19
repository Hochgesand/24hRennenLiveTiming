/**
 * StatsTabSection — composes the Statistik tab content with skeleton-loading
 * and reconnect-dim behaviour.
 *
 * Stories: PRD-statistics-cockpit.md §"Empty / loading / error states" items
 * 1 and 3. Item 2 (LTS_NOT_FOUND overlay priority) is handled upstream:
 *
 * Note: when LTS_NOT_FOUND is reported, App.tsx renders <EventNotFoundOverlay/>
 * BEFORE <AppShellRouter/>, so this tab never even mounts. See
 * PRD-statistics-cockpit.md § "Empty / loading / error states" item 2.
 *
 * Skeleton branch (story 1): when `statistics === null` (Pre-session, right
 * after LTS_TIMESYNC, or between snapshots), we collapse the tab to a single
 * italic "Statistik wird geladen…" line. The KPI strip stays because it owns
 * its own em-dash skeleton. The class filter, bar chart, sector heatmap and
 * leading table are intentionally not mounted — each of them renders its own
 * italic "no data" fallback, which would duplicate the unified loading line.
 *
 * Dim branch (story 3): the whole tab body (skeleton AND populated) is wrapped
 * in a div that fades to 60 % opacity when `connection.reconnecting === true`,
 * with a 200 ms `transition-opacity` so the dim is a smooth fade rather than a
 * flash. Wrapping both branches means a reconnect mid-session keeps the
 * existing data visible (dimmed) instead of collapsing back to the skeleton.
 */
import { BestLapPerClassChart } from "@/components/stats/BestLapPerClassChart"
import { LeadingTable } from "@/components/stats/LeadingTable"
import { SectorHeatmap } from "@/components/stats/SectorHeatmap"
import { StatsClassFilter } from "@/components/stats/StatsClassFilter"
import { StatsKpiStrip } from "@/components/stats/StatsKpiStrip"
import { StatisticsPanel } from "@/components/StatisticsPanel"
import { StatsSubTabs } from "@/components/shell/StatsSubTabs"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"

export type StatsTabSectionProps = {
  bp: Breakpoint
}

export function StatsTabSection({ bp }: StatsTabSectionProps) {
  const statistics = useLiveStore((s) => s.statistics)
  const isReconnecting = useLiveStore((s) => s.connection.reconnecting)
  const { t } = useI18n()

  const isSkeleton = statistics === null
  const isDesktopLike = bp !== "mobile"

  const wrapperClass = [
    "flex min-h-0 min-w-0 flex-1 flex-col gap-6 transition-opacity duration-200",
    isReconnecting ? "opacity-60" : "opacity-100",
  ].join(" ")

  return (
    <div
      data-testid="stats-tab-section"
      data-reconnecting={isReconnecting ? "true" : "false"}
      className={wrapperClass}
    >
      {isDesktopLike ? <StatsSubTabs /> : null}
      <StatsKpiStrip />
      {isSkeleton ? (
        <p
          data-testid="stats-loading"
          role="status"
          aria-live="polite"
          className="text-zinc-500 text-xs italic font-headline tracking-wider"
        >
          {t("stats.loading.line")}
        </p>
      ) : (
        <>
          <StatsClassFilter />
          {/* The bar chart now hosts class/car/team tabs internally and takes
              full width. The sector heatmap moved to the bottom of the
              section per Apr 2026 follow-up — heatmap is reference data that
              users scroll to last. */}
          <BestLapPerClassChart />
          <LeadingTable />
          <StatisticsPanel />
          <SectorHeatmap />
        </>
      )}
    </div>
  )
}
