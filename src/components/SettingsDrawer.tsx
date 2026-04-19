import { useI18n } from "@/i18n/I18nContext"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlTab } from "@/hooks/useUrlNavigation"
import { useUiStore } from "@/store/useUiStore"

import { SettingsPanel } from "@/components/SettingsPanel"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function SettingsDrawer() {
  const { t } = useI18n()
  const open = useUiStore((s) => s.settingsDrawerOpen)
  const setOpen = useUiStore((s) => s.setSettingsDrawerOpen)
  const tab = useUrlConfig().tab

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && tab === "settings") {
      setUrlTab("leaderboard")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="fixed top-0 right-0 bottom-0 left-auto flex h-full max-h-svh w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l p-0 sm:max-w-lg"
      >
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <SettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  )
}
