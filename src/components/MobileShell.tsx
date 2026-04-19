import { BarChart3, Flag, MessageSquare, Settings } from "lucide-react"
import { useMemo, type ReactNode } from "react"

import { Leaderboard } from "@/components/Leaderboard"
import { MessagesPanel } from "@/components/MessagesPanel"
import { MiniPodium } from "@/components/MiniPodium"
import { SessionHeader } from "@/components/SessionHeader"
import { SettingsPanel } from "@/components/SettingsPanel"
import { StatisticsPanel } from "@/components/StatisticsPanel"
import { TopQualifyingPanel } from "@/components/TopQualifyingPanel"
import { TrackMapPanel } from "@/components/TrackMapPanel"
import { Button } from "@/components/ui/button"
import type { AppTab } from "@/hooks/useUrlConfig"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlTab } from "@/hooks/useUrlNavigation"
import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"
import { cn } from "@/lib/utils"

type MobileTab = "leaderboard" | "stats" | "messages" | "settings"

function urlTabToMobile(tab: AppTab): MobileTab {
  switch (tab) {
    case "stats":
    case "trackmap":
    case "stq":
      return "stats"
    case "messages":
      return "messages"
    case "settings":
      return "settings"
    default:
      return "leaderboard"
  }
}

function mobileTabToUrl(tab: MobileTab): AppTab {
  return tab
}

export function MobileShell() {
  const { t } = useI18n()
  const urlTab = useUrlConfig().tab
  const stqActive = Boolean(useLiveStore((s) => s.sessionMeta?.STQ))

  const mobileTab = useMemo(() => urlTabToMobile(urlTab), [urlTab])

  const selectTab = (next: MobileTab) => {
    setUrlTab(mobileTabToUrl(next))
  }

  const barBtn = (key: MobileTab, icon: ReactNode, label: string) => {
    const active = mobileTab === key
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "text-muted-foreground hover:text-foreground flex h-auto flex-1 flex-col gap-0.5 rounded-none py-2 text-[10px] font-medium",
          active && "bg-white/[0.06] text-foreground"
        )}
        onClick={() => selectTab(key)}
      >
        <span className="inline-flex size-5 items-center justify-center" aria-hidden>
          {icon}
        </span>
        <span className="leading-none">{label}</span>
      </Button>
    )
  }

  return (
    <div className="text-foreground flex min-h-svh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
      <SessionHeader compact />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {mobileTab === "leaderboard" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <MiniPodium />
            {stqActive ? <TopQualifyingPanel /> : null}
            <div className="min-h-0 flex-1 p-3">
              <Leaderboard />
            </div>
          </div>
        ) : null}
        {mobileTab === "stats" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3">
            <StatisticsPanel />
            <TrackMapPanel />
          </div>
        ) : null}
        {mobileTab === "messages" ? (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <MessagesPanel />
          </div>
        ) : null}
        {mobileTab === "settings" ? (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <h2 className="font-display mb-4 text-lg font-semibold">{t("settings.title")}</h2>
            <SettingsPanel />
          </div>
        ) : null}
      </div>

      <nav
        className="border-border bg-[#101419]/95 fixed right-0 bottom-0 left-0 z-40 flex border-t backdrop-blur-md"
        aria-label="Primary"
      >
        {barBtn("leaderboard", <Flag className="size-4" />, t("mobile.race"))}
        {barBtn("stats", <BarChart3 className="size-4" />, t("tab.stats"))}
        {barBtn("messages", <MessageSquare className="size-4" />, t("tab.messages"))}
        {barBtn("settings", <Settings className="size-4" />, t("tab.settings"))}
      </nav>
    </div>
  )
}
