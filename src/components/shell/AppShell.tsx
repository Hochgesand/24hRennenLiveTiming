import { useMemo, type ReactNode } from "react"

import { ConnectionBanner } from "@/components/ConnectionBanner"
import { PodiumRibbon } from "@/components/PodiumRibbon"
import { BrandTopBar } from "@/components/shell/BrandTopBar"
import { LiveStateRibbon } from "@/components/shell/LiveStateRibbon"
import { MobileBottomNav, type MobileNavId } from "@/components/shell/MobileBottomNav"
import { SideNav, type SideNavTab } from "@/components/shell/SideNav"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import type { AppTab } from "@/hooks/useUrlConfig"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlTab } from "@/hooks/useUrlNavigation"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

export type AppShellProps = {
  children: ReactNode
}

const PODIUM_TABS: ReadonlySet<AppTab> = new Set<AppTab>(["leaderboard", "stq"])

function mapTabForMobile(tab: AppTab): MobileNavId {
  if (tab === "messages") {
    return "messages"
  }
  if (tab === "settings") {
    return "settings"
  }
  if (tab === "stats" || tab === "trackmap" || tab === "stq") {
    return "stats"
  }
  return "leaderboard"
}

function mapTabForSideNav(tab: AppTab): SideNavTab {
  if (tab === "settings") {
    return "leaderboard"
  }
  return tab
}

export function AppShell({ children }: AppShellProps) {
  const { tab } = useUrlConfig()
  const bp = useBreakpoint()
  const stqVisible = Boolean(useLiveStore((s) => s.sessionMeta?.STQ))
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen)

  const showPodium = PODIUM_TABS.has(tab)

  const onSelectDesktopTab = (next: SideNavTab) => {
    setUrlTab(next)
  }

  const onSelectMobileTab = (next: MobileNavId) => {
    setUrlTab(next)
  }

  const mobileActive = useMemo(() => mapTabForMobile(tab), [tab])

  if (bp === "mobile") {
    return (
      <div className="text-foreground flex min-h-svh flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        <BrandTopBar />
        <LiveStateRibbon />
        <ConnectionBanner />
        {showPodium ? <PodiumRibbon /> : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</main>
        <MobileBottomNav active={mobileActive} onSelect={onSelectMobileTab} />
      </div>
    )
  }

  return (
    <div className="text-foreground flex min-h-svh">
      <SideNav
        activeTab={mapTabForSideNav(tab)}
        onSelect={onSelectDesktopTab}
        stqVisible={stqVisible}
        onLiveFeedClick={() => setSettingsDrawerOpen(true)}
      />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col lg:ml-64">
        <BrandTopBar />
        <LiveStateRibbon />
        <ConnectionBanner />
        {showPodium ? <PodiumRibbon /> : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-6 bg-[color-mix(in_srgb,var(--stitch-surface-container-low)_92%,transparent)]">
          {children}
        </main>
      </div>
    </div>
  )
}
