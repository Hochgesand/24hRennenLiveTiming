import { useI18n } from "@/i18n/I18nContext"

export type MobileNavId = "leaderboard" | "stats" | "messages" | "settings"

type MobileNavItem = {
  id: MobileNavId
  icon: string
  labelKey: string
}

const ITEMS: ReadonlyArray<MobileNavItem> = [
  { id: "leaderboard", icon: "speed", labelKey: "mobile.race" },
  { id: "stats", icon: "leaderboard", labelKey: "tab.stats" },
  { id: "messages", icon: "notifications", labelKey: "tab.messages" },
  { id: "settings", icon: "settings", labelKey: "mobile.setup" },
]

export type MobileBottomNavProps = {
  active: MobileNavId
  onSelect: (id: MobileNavId) => void
  className?: string
}

export function MobileBottomNav({ active, onSelect, className }: MobileBottomNavProps) {
  const { t } = useI18n()

  const navClass = [
    "fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-[#1c1d1e] h-16 shadow-[0_-4px_24px_rgba(227,6,19,0.08)]",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <nav aria-label="Primary" className={navClass}>
      {ITEMS.map((item) => {
        const isActive = active === item.id
        const buttonClass = isActive
          ? "flex flex-col items-center justify-center text-[#E30613] border-t-2 border-[#E30613] pt-2 pb-3 bg-[#2a2b2c] flex-1 focus-ring"
          : "flex flex-col items-center justify-center text-gray-500 pt-2 pb-3 opacity-60 flex-1 focus-ring"
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={buttonClass}
          >
            <span
              className="material-symbols-outlined mb-1"
              data-icon={item.icon}
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="font-['Inter'] text-[10px] uppercase tracking-widest font-semibold">
              {t(item.labelKey)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
