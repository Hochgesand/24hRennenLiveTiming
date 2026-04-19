import { useI18n } from "@/i18n/I18nContext"

export function EventNotFoundOverlay() {
  const { t } = useI18n()

  return (
    <div
      className="bg-background fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 p-6 text-center"
      role="alert"
    >
      <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">
        {t("empty.eventNotFound")}
      </h1>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        {t("empty.eventNotFound.detail")}
      </p>
    </div>
  )
}
