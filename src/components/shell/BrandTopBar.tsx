import { useEffect, useState } from "react"

import {
  endTimeDisplay,
  isTimeStateCountdown,
  trackStateLabel,
} from "@/components/shell/sessionInfo"
import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

export type BrandTopBarProps = {
  className?: string
}

function joinSessionCaption(
  meta: { CUP?: string; SESSION?: string; HEAT?: string; TRACKNAME?: string } | null
): string {
  if (!meta) {
    return ""
  }
  return [meta.CUP, meta.SESSION, meta.HEAT, meta.TRACKNAME]
    .map((p) => (p === undefined || p === null ? "" : String(p)))
    .filter((p) => p.length > 0)
    .join(" · ")
}

export function BrandTopBar({ className }: BrandTopBarProps) {
  const { t } = useI18n()
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen)
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const track = useLiveStore((s) => s.track)
  const remoteTimeDiffMs = useLiveStore((s) => s.connection.remoteTimeDiffMs)

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const headerClass = [
    "bg-zinc-950/90 backdrop-blur-xl sticky w-full top-0 z-50 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const sessionCaption = joinSessionCaption(sessionMeta)
  const showSessionCluster = sessionMeta !== null
  const trackBadge = trackStateLabel(
    track?.TRACKSTATE !== undefined ? String(track.TRACKSTATE) : undefined,
    t
  )
  const countdown = isTimeStateCountdown(track)
  const endTimeLabel = endTimeDisplay(track, remoteTimeDiffMs, nowMs)

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
          {showSessionCluster && sessionCaption.length > 0 ? (
            <span
              data-testid="brand-session-info"
              className="text-zinc-400 font-headline text-[10px] uppercase tracking-widest hidden md:inline truncate max-w-[40ch]"
            >
              {sessionCaption}
            </span>
          ) : null}
        </div>
        {showSessionCluster ? (
          <div
            data-testid="brand-session-status"
            className="flex items-center gap-3"
          >
            <span
              data-testid="brand-track-badge"
              className={`hidden md:inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${trackBadge.className}`}
            >
              {trackBadge.label}
            </span>
            <span
              data-testid="brand-countdown"
              className="hidden md:inline font-mono text-[10px] tabular-nums text-zinc-400"
            >
              {countdown ? "REM" : "END"} {endTimeLabel}
            </span>
          </div>
        ) : null}
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
