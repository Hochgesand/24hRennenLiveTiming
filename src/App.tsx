import { useEffect } from "react"

import { CarDrilldownDialog } from "@/components/CarDrilldownDialog"
import { EventNotFoundOverlay } from "@/components/EventNotFoundOverlay"
import { SettingsDrawer } from "@/components/SettingsDrawer"
import { AppShellRouter } from "@/components/shell/AppShellRouter"
import { I18nProvider } from "@/i18n/I18nContext"
import { useLiveConnection } from "@/hooks/useLiveConnection"
import { useSyncFiltersFromUrl } from "@/hooks/useSyncFiltersFromUrl"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { useLiveStore } from "@/store/useLiveStore"

function isEventNotFoundError(error: string | null): boolean {
  return error !== null && error.trim().toLowerCase() === "event not found"
}

export default function App() {
  const { lang } = useUrlConfig()
  const connectionError = useLiveStore((s) => s.connection.error)

  useLiveConnection()
  useSyncFiltersFromUrl()

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "de"
  }, [lang])

  const eventNotFound = isEventNotFoundError(connectionError)

  return (
    <I18nProvider locale={lang}>
      {eventNotFound ? <EventNotFoundOverlay /> : <AppShellRouter />}
      {!eventNotFound ? <CarDrilldownDialog /> : null}
      {!eventNotFound ? <SettingsDrawer /> : null}
    </I18nProvider>
  )
}
