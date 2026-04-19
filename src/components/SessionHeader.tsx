import { Settings } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/I18nContext"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import type { Pid4Frame } from "@/domain"
import type { ConnectionStatus } from "@/store/useLiveStore"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"
import { cn } from "@/lib/utils"

function connectionUi(
  status: ConnectionStatus,
  reconnecting: boolean,
  t: (key: string) => string
): { dotClass: string; labelClass: string; label: string } {
  if (reconnecting) {
    return {
      dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse",
      labelClass: "text-amber-700 dark:text-amber-300",
      label: t("conn.reconnecting"),
    }
  }
  switch (status) {
    case "idle":
    case "connecting":
      return {
        dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse",
        labelClass: "text-amber-700 dark:text-amber-300",
        label: t("conn.connecting"),
      }
    case "connected":
      return {
        dotClass:
          "bg-[var(--stitch-secondary)] shadow-[0_0_12px_color-mix(in_srgb,var(--stitch-secondary)_40%,transparent)]",
        labelClass: "text-[var(--stitch-secondary)]",
        label: t("conn.connected"),
      }
    case "error":
      return {
        dotClass: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]",
        labelClass: "text-red-700 dark:text-red-300",
        label: t("conn.error"),
      }
    case "closed":
      return {
        dotClass: "bg-muted-foreground/60",
        labelClass: "text-muted-foreground",
        label: t("conn.closed"),
      }
  }
}

function formatMmSs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function trackStateLabel(
  raw: string | undefined,
  t: (key: string) => string
): { label: string; className: string } {
  const key = raw === undefined ? "" : String(raw).trim()
  const n = Number.parseInt(key, 10)
  if (!Number.isNaN(n)) {
    switch (n) {
      case 0:
        return {
          label: t("track.green"),
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        }
      case 1:
        return {
          label: t("track.yellow"),
          className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        }
      case 2:
        return {
          label: t("track.red"),
          className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
        }
      case 3:
        return {
          label: t("track.sc"),
          className: "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-200",
        }
      default:
        return { label: key, className: "border-border text-muted-foreground" }
    }
  }
  if (!key) {
    return { label: "—", className: "border-border text-muted-foreground" }
  }
  return { label: key, className: "border-border text-muted-foreground" }
}

function endTimeDisplay(
  track: Pid4Frame | null,
  remoteTimeDiffMs: number,
  nowMs: number
): string {
  if (!track) {
    return "—"
  }
  const raw = track.ENDTIME
  if (raw === undefined || raw === null || raw === "") {
    return "—"
  }
  const end = Number(raw)
  if (!Number.isFinite(end)) {
    return "—"
  }
  const timeState = track?.TIMESTATE !== undefined ? String(track.TIMESTATE) : ""
  if (timeState !== "0") {
    return new Date(end).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }
  const serverNow = nowMs + remoteTimeDiffMs
  return formatMmSs(end - serverNow)
}

function isTimeStateCountdown(track: Pid4Frame | null): boolean {
  if (!track) {
    return false
  }
  return String(track.TIMESTATE ?? "") === "0"
}

export function SessionHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const { eventId } = useUrlConfig()
  const missingEvent = !eventId

  const connection = useLiveStore((s) => s.connection)
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const track = useLiveStore((s) => s.track)
  const setSettingsDrawerOpen = useUiStore((s) => s.setSettingsDrawerOpen)

  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const trackBadge = trackStateLabel(
    track?.TRACKSTATE !== undefined ? String(track.TRACKSTATE) : undefined,
    t
  )

  const primaryParts = [
    sessionMeta?.CUP,
    sessionMeta?.SESSION,
    sessionMeta?.HEAT,
    sessionMeta?.TRACKNAME,
  ]
    .map((p) => (p !== undefined && p !== null ? String(p) : ""))
    .filter((p) => p.length > 0)

  const primaryLine = primaryParts.join(" · ")

  const showConnecting =
    !missingEvent && (connection.status === "idle" || connection.status === "connecting")

  const countdown = isTimeStateCountdown(track)

  const connUi = connectionUi(connection.status, connection.reconnecting, t)

  const showWsLabel = compact ? connection.reconnecting || connection.status !== "connected" : true

  return (
    <header className="border-border bg-[var(--stitch-surface-container-lowest)] flex min-h-14 flex-col justify-center gap-2 border-b px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {missingEvent ? (
            <p className="text-muted-foreground text-sm">{t("header.addEvent")}</p>
          ) : connection.status === "error" ? (
            <p className="text-destructive text-sm font-medium">
              {connection.error ?? t("conn.error")}
            </p>
          ) : connection.status === "closed" ? (
            <p className="text-muted-foreground text-sm">{t("header.connectionClosed")}</p>
          ) : showConnecting ? (
            <p className="text-muted-foreground animate-pulse text-sm">{t("header.connecting")}</p>
          ) : connection.status === "connected" && !sessionMeta ? (
            <p className="text-muted-foreground text-sm">{t("header.waiting")}</p>
          ) : (
            <>
              <div
                className={cn(
                  "font-display text-foreground font-semibold leading-tight tracking-tight",
                  compact ? "line-clamp-2 text-sm" : "text-xl"
                )}
              >
                {primaryLine.length > 0 ? (
                  primaryLine
                ) : (
                  <span className="text-muted-foreground font-normal">{t("header.waiting")}</span>
                )}
              </div>
              {!compact ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${trackBadge.className}`}>
                    {t("header.track")}: {trackBadge.label}
                  </span>
                  {track?.TIMESTATE !== undefined && String(track.TIMESTATE) !== "" ? (
                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs">
                      {t("header.timeState")}: {String(track.TIMESTATE)}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {countdown ? `${t("header.remaining")}: ` : `${t("header.end")}: `}
                    {endTimeDisplay(track, connection.remoteTimeDiffMs, nowMs)}
                  </span>
                </div>
              ) : (
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tabular-nums">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${trackBadge.className}`}>
                    {trackBadge.label}
                  </span>
                  <span>
                    {countdown ? `${t("header.remaining")}: ` : `${t("header.end")}: `}
                    {endTimeDisplay(track, connection.remoteTimeDiffMs, nowMs)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
          {!compact ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8 shrink-0"
              aria-label={t("settings.openDrawer")}
              onClick={() => setSettingsDrawerOpen(true)}
            >
              <Settings className="size-4" aria-hidden />
            </Button>
          ) : null}
          <div
            className="flex shrink-0 items-center gap-1.5"
            title={`${connUi.label}`}
            role="status"
            aria-live="polite"
          >
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${connUi.dotClass}`} aria-hidden />
            {showWsLabel ? (
              <span className={`text-xs font-medium ${connUi.labelClass}`}>{connUi.label}</span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
