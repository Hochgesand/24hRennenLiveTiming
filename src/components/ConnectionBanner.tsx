import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"

export function ConnectionBanner() {
  const reconnecting = useLiveStore((s) => s.connection.reconnecting)
  const { t } = useI18n()

  if (!reconnecting) {
    return null
  }

  return (
    <div
      className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
      role="status"
      aria-live="polite"
    >
      {t("banner.reconnecting")}
    </div>
  )
}
