import { useEffect } from "react"

import { ConnectionBanner } from "@/components/ConnectionBanner"
import { Leaderboard } from "@/components/Leaderboard"
import { MessagesPanel } from "@/components/MessagesPanel"
import { PodiumRibbon } from "@/components/PodiumRibbon"
import { SessionHeader } from "@/components/SessionHeader"
import { StatisticsPanel } from "@/components/StatisticsPanel"
import { TopQualifyingPanel } from "@/components/TopQualifyingPanel"
import { TrackMapPanel } from "@/components/TrackMapPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppTab } from "@/hooks/useUrlConfig"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlTab } from "@/hooks/useUrlNavigation"
import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

export function DashboardShell() {
  const { t } = useI18n()
  const tab = useUrlConfig().tab
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const stqVisible = Boolean(sessionMeta?.STQ)
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

  const onTabChange = (value: string) => {
    setUrlTab(value as AppTab)
  }

  return (
    <div className="text-foreground flex min-h-svh min-w-0 flex-col">
      <SessionHeader />
      <ConnectionBanner />
      <PodiumRibbon />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 bg-[#181c21]/80 p-4">
        <Tabs
          value={displayTab}
          onValueChange={onTabChange}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
        >
          <TabsList variant="line" className="h-auto w-full shrink-0 flex-wrap justify-start gap-1 p-0">
            <TabsTrigger value="leaderboard">{t("tab.leaderboard")}</TabsTrigger>
            <TabsTrigger value="stats">{t("tab.stats")}</TabsTrigger>
            <TabsTrigger value="messages">{t("tab.messages")}</TabsTrigger>
            <TabsTrigger value="trackmap">{t("tab.trackmap")}</TabsTrigger>
            {stqVisible ? <TabsTrigger value="stq">{t("tab.stq")}</TabsTrigger> : null}
          </TabsList>
          <TabsContent
            value="leaderboard"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-auto data-[state=inactive]:hidden"
          >
            <Leaderboard />
          </TabsContent>
          <TabsContent
            value="stats"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-auto data-[state=inactive]:hidden"
          >
            <StatisticsPanel />
          </TabsContent>
          <TabsContent
            value="messages"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-auto data-[state=inactive]:hidden"
          >
            <MessagesPanel />
          </TabsContent>
          <TabsContent
            value="trackmap"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-auto data-[state=inactive]:hidden"
          >
            <TrackMapPanel />
          </TabsContent>
          {stqVisible ? (
            <TabsContent
              value="stq"
              className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-auto data-[state=inactive]:hidden"
            >
              <TopQualifyingPanel />
            </TabsContent>
          ) : null}
        </Tabs>
      </main>
    </div>
  )
}
