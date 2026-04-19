import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"

export type LiveStateRibbonProps = {
  className?: string
}

export function LiveStateRibbon({ className }: LiveStateRibbonProps) {
  const status = useLiveStore((s) => s.connection.status)
  const reconnecting = useLiveStore((s) => s.connection.reconnecting)
  const error = useLiveStore((s) => s.connection.error)
  const { t } = useI18n()

  let dotClass: string
  let labelKey: string
  if (reconnecting) {
    dotClass = "bg-amber-400 animate-pulse"
    labelKey = "shell.liveState.reconnecting"
  } else if (status === "connected") {
    dotClass = "bg-red-600 animate-pulse"
    labelKey = "shell.liveState.connected"
  } else if (status === "connecting") {
    dotClass = "bg-amber-400 animate-pulse"
    labelKey = "shell.liveState.connecting"
  } else {
    dotClass = "bg-zinc-600"
    labelKey = "shell.liveState.offline"
  }

  const baseLabel = t(labelKey)
  const label = error ? `${baseLabel} · ${error}` : baseLabel

  const wrapperClass = [
    "h-14 lg:h-10 flex items-center px-6 bg-surface-container-lowest/50 border-b border-outline-variant/10",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div role="status" aria-live="polite" className={wrapperClass}>
      <div className="flex items-center gap-2 text-[10px] font-headline font-bold text-zinc-500 tracking-tighter uppercase">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  )
}
