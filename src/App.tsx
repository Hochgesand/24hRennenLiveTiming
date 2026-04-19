import { useEffect } from "react"

import { CarDrilldownDialog } from "@/components/CarDrilldownDialog"
import { DashboardShell } from "@/components/DashboardShell"
import { EventNotFoundOverlay } from "@/components/EventNotFoundOverlay"
import { MobileShell } from "@/components/MobileShell"
import { SettingsDrawer } from "@/components/SettingsDrawer"
import { I18nProvider } from "@/i18n/I18nContext"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useLiveConnection } from "@/hooks/useLiveConnection"
import { useSyncFiltersFromUrl } from "@/hooks/useSyncFiltersFromUrl"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { useLiveStore } from "@/store/useLiveStore"

function isEventNotFoundError(error: string | null): boolean {
  return error !== null && error.trim().toLowerCase() === "event not found"
}

export default function App() {
  const { lang } = useUrlConfig()
  const bp = useBreakpoint()
  const connectionError = useLiveStore((s) => s.connection.error)

  useLiveConnection()
  useSyncFiltersFromUrl()

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "de"
  }, [lang])

  const eventNotFound = isEventNotFoundError(connectionError)

  return (
    <I18nProvider locale={lang}>
      {eventNotFound ? (
        <EventNotFoundOverlay />
      ) : bp === "mobile" ? (
        <MobileShell />
      ) : (
        <DashboardShell />
      )}
      {!eventNotFound ? <CarDrilldownDialog /> : null}
      {!eventNotFound ? <SettingsDrawer /> : null}
    </I18nProvider>
  )
}
