import { useEffect } from "react"

import { Leaderboard } from "@/components/Leaderboard"
import { MessagesPanel } from "@/components/MessagesPanel"
import { AppShell } from "@/components/shell/AppShell"
import { StatsSubTabs } from "@/components/shell/StatsSubTabs"
import { StatsClassFilter } from "@/components/stats/StatsClassFilter"
import { StatsKpiStrip } from "@/components/stats/StatsKpiStrip"
import { StatisticsPanel } from "@/components/StatisticsPanel"
import { TopQualifyingPanel } from "@/components/TopQualifyingPanel"
import { TrackMapPanel } from "@/components/TrackMapPanel"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import type { AppTab } from "@/hooks/useUrlConfig"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlTab } from "@/hooks/useUrlNavigation"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

export function AppShellRouter() {
  const { tab } = useUrlConfig()
  const stqVisible = Boolean(useLiveStore((s) => s.sessionMeta?.STQ))
  const bp = useBreakpoint()
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen)

  useEffect(() => {
    if (tab === "stq" && !stqVisible) {
      setUrlTab("leaderboard")
    }
  }, [tab, stqVisible])

  useEffect(() => {
    if (tab === "settings") {
      setSettingsDrawerOpen(true)
    }
  }, [tab, setSettingsDrawerOpen])

  let displayTab: AppTab = tab
  if (tab === "settings") {
    displayTab = "leaderboard"
  } else if (tab === "stq" && !stqVisible) {
    displayTab = "leaderboard"
  }

  return (
    <AppShell>
      {displayTab === "leaderboard" ? <Leaderboard /> : null}
      {displayTab === "stats" ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">
          {bp !== "mobile" ? <StatsSubTabs /> : null}
          <StatsKpiStrip />
          <StatsClassFilter />
          <StatisticsPanel />
        </div>
      ) : null}
      {displayTab === "messages" ? <MessagesPanel /> : null}
      {displayTab === "trackmap" ? <TrackMapPanel /> : null}
      {displayTab === "stq" && stqVisible ? <TopQualifyingPanel /> : null}
    </AppShell>
  )
}
