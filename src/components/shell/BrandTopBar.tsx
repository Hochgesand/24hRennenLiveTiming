import { useUiStore } from "@/store/useUiStore"

export type BrandTopBarProps = {
  className?: string
}

export function BrandTopBar({ className }: BrandTopBarProps) {
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen)

  const headerClass = [
    "bg-zinc-950/90 backdrop-blur-xl sticky w-full top-0 z-50 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <header className={headerClass}>
      <div className="flex justify-between items-center w-full px-6 h-16">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black italic tracking-tighter text-red-600 font-headline uppercase">
            LIVE TIMING
          </span>
          <span className="hidden md:inline text-zinc-500 font-headline text-[10px] uppercase tracking-widest">
            24H NÜRBURGRING
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Search"
            data-todo="search"
            onClick={() => {}}
            className="hover:bg-zinc-800/50 transition-all duration-200 p-2 rounded"
          >
            <span className="material-symbols-outlined text-zinc-400" data-icon="search">
              search
            </span>
          </button>
          <button
            type="button"
            aria-label="Notifications"
            data-todo="notifications"
            onClick={() => {}}
            className="hover:bg-zinc-800/50 transition-all duration-200 p-2 rounded"
          >
            <span className="material-symbols-outlined text-zinc-400" data-icon="notifications">
              notifications
            </span>
          </button>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsDrawerOpen(true)}
            className="hover:bg-zinc-800/50 transition-all duration-200 p-2 rounded"
          >
            <span className="material-symbols-outlined text-zinc-400" data-icon="settings">
              settings
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
