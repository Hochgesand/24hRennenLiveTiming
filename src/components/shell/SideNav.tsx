import { useI18n } from "@/i18n/I18nContext"

export type SideNavTab = "leaderboard" | "stats" | "messages" | "trackmap" | "stq"

export type SideNavProps = {
  activeTab: SideNavTab
  onSelect: (tab: SideNavTab) => void
  stqVisible?: boolean
  onLiveFeedClick?: () => void
  className?: string
}

type SideNavItem = {
  label: string
  urlTab: SideNavTab
  icon: string
  labelKey: string
  alwaysInactive?: boolean
}

// TODO: Cockpit will get its own URL state in a v2 follow-up; for now Rangliste owns active=leaderboard.
const ITEMS: ReadonlyArray<SideNavItem> = [
  {
    label: "Cockpit",
    urlTab: "leaderboard",
    icon: "dashboard",
    labelKey: "shell.sideNav.cockpit",
    alwaysInactive: true,
  },
  { label: "Rangliste", urlTab: "leaderboard", icon: "leaderboard", labelKey: "tab.leaderboard" },
  { label: "Statistik", urlTab: "stats", icon: "analytics", labelKey: "tab.stats" },
  { label: "Streckenkarte", urlTab: "trackmap", icon: "map", labelKey: "tab.trackmap" },
  { label: "Top-Qualifying", urlTab: "stq", icon: "flag", labelKey: "tab.stq" },
  { label: "Meldungen", urlTab: "messages", icon: "notifications", labelKey: "tab.messages" },
]

const ACTIVE_CLASS =
  "bg-red-600/10 text-red-600 border-l-4 border-red-600 px-6 py-3 flex items-center gap-3 font-headline text-xs uppercase tracking-widest text-left"

const INACTIVE_CLASS =
  "text-zinc-500 px-6 py-3 flex items-center gap-3 hover:text-zinc-200 transition-colors font-headline text-xs uppercase tracking-widest text-left"

export function SideNav({
  activeTab,
  onSelect,
  stqVisible = false,
  onLiveFeedClick,
  className,
}: SideNavProps) {
  const { t } = useI18n()

  const asideClass = [
    "h-screen w-64 fixed left-0 top-0 overflow-hidden bg-zinc-950 pt-20 hidden lg:block",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const visibleItems = ITEMS.filter((it) => stqVisible || it.urlTab !== "stq")

  return (
    <aside className={asideClass}>
      <div className="flex flex-col h-full py-8 space-y-2">
        <div className="px-6 mb-8">
          <h3 className="text-red-600 font-black font-headline text-xs tracking-widest uppercase mb-1">
            STRAT_OFFICER_01
          </h3>
          <p className="text-zinc-500 font-headline text-[10px] uppercase tracking-widest">
            {t("shell.sideNav.brandSubtitle")}
          </p>
        </div>
        {visibleItems.map((it) => {
          const isActive = it.urlTab === activeTab && !it.alwaysInactive
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => onSelect(it.urlTab)}
              aria-current={isActive ? "page" : undefined}
              className={isActive ? ACTIVE_CLASS : INACTIVE_CLASS}
            >
              <span
                className="material-symbols-outlined"
                data-icon={it.icon}
                aria-hidden="true"
              >
                {it.icon}
              </span>
              <span>{t(it.labelKey)}</span>
            </button>
          )
        })}
        <div className="mt-auto px-6 pb-24">
          <button
            type="button"
            onClick={() => onLiveFeedClick?.()}
            className="w-full bg-primary-container text-on-primary-container py-3 font-headline text-[10px] font-black tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            LIVE FEED
          </button>
        </div>
      </div>
    </aside>
  )
}
