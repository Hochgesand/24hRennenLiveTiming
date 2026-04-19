import type { MouseEvent } from "react"

import { useI18n } from "@/i18n/I18nContext"

export type StatsSubTabId = "statistik"

export type StatsSubTabsProps = {
  className?: string
  onSelect?: (id: StatsSubTabId) => void
}

export function StatsSubTabs({ className, onSelect }: StatsSubTabsProps) {
  const { t } = useI18n()

  const wrapperClass = ["flex flex-col md:flex-row md:items-end justify-between gap-4", className]
    .filter(Boolean)
    .join(" ")

  const handleDisabledClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  return (
    <div className={wrapperClass}>
      <div>
        <h1 className="font-headline font-black text-4xl uppercase tracking-tighter text-on-surface">
          {t("shell.cockpit.title")}
        </h1>
        <p className="text-zinc-500 font-label text-xs uppercase tracking-[0.2em] mt-1">
          {t("shell.cockpit.subtitle")}
        </p>
      </div>
      <div
        className="flex gap-1 bg-surface-container-low p-1 rounded-sm"
        role="tablist"
        aria-label={t("shell.subTabs.ariaLabel")}
      >
        <button
          type="button"
          role="tab"
          aria-selected="true"
          onClick={() => onSelect?.("statistik")}
          className="px-6 py-2 text-xs font-headline font-bold uppercase tracking-widest bg-primary-container text-on-primary-container"
        >
          {t("shell.subTabs.statistik")}
        </button>
        <button
          type="button"
          role="tab"
          aria-disabled="true"
          title={t("shell.subTabs.comingSoon")}
          tabIndex={-1}
          onClick={handleDisabledClick}
          className="px-6 py-2 text-xs font-headline font-bold uppercase tracking-widest text-zinc-500 cursor-not-allowed opacity-40"
        >
          {t("shell.subTabs.verlauf")}
        </button>
        <button
          type="button"
          role="tab"
          aria-disabled="true"
          title={t("shell.subTabs.comingSoon")}
          tabIndex={-1}
          onClick={handleDisabledClick}
          className="px-6 py-2 text-xs font-headline font-bold uppercase tracking-widest text-zinc-500 cursor-not-allowed opacity-40"
        >
          {t("shell.subTabs.deltaAi")}
        </button>
      </div>
    </div>
  )
}
