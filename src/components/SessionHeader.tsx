import { useEffect, useState } from "react"

import { useUrlConfig } from "@/hooks/useUrlConfig"
import type { Pid4Frame } from "@/domain"
import type { ConnectionStatus } from "@/store/useLiveStore"
import { useLiveStore } from "@/store/useLiveStore"

function connectionStatusIndicator(status: ConnectionStatus): { dotClass: string; labelClass: string; label: string } {
  switch (status) {
    case "idle":
    case "connecting":
      return {
        dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse",
        labelClass: "text-amber-700 dark:text-amber-300",
        label: "Connecting",
      }
    case "connected":
      return {
        dotClass: "bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.45)]",
        labelClass: "text-[#a5f3fc]",
        label: "Connected",
      }
    case "error":
      return {
        dotClass: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]",
        labelClass: "text-red-700 dark:text-red-300",
        label: "Error",
      }
    case "closed":
      return {
        dotClass: "bg-muted-foreground/60",
        labelClass: "text-muted-foreground",
        label: "Closed",
      }
  }
}

function formatMmSs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function trackStateLabel(raw: string | undefined): { label: string; className: string } {
  const key = raw === undefined ? "" : String(raw).trim()
  const n = Number.parseInt(key, 10)
  if (!Number.isNaN(n)) {
    switch (n) {
      case 0:
        return {
          label: "Green",
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        }
      case 1:
        return {
          label: "Yellow",
          className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        }
      case 2:
        return {
          label: "Red",
          className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
        }
      case 3:
        return {
          label: "SC",
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

export function SessionHeader() {
  const { eventId } = useUrlConfig()
  const missingEvent = !eventId

  const connection = useLiveStore((s) => s.connection)
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const track = useLiveStore((s) => s.track)

  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const trackBadge = trackStateLabel(track?.TRACKSTATE !== undefined ? String(track.TRACKSTATE) : undefined)

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

  const connUi = connectionStatusIndicator(connection.status)

  return (
    <header className="flex min-h-14 flex-col justify-center gap-2 border-b border-white/[0.08] bg-[#101419] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {missingEvent ? (
            <p className="text-muted-foreground text-sm">
              Add <span className="font-mono">?event=50</span> to the URL to load live timing.
            </p>
          ) : connection.status === "error" ? (
            <p className="text-destructive text-sm font-medium">{connection.error ?? "Connection error"}</p>
          ) : connection.status === "closed" ? (
            <p className="text-muted-foreground text-sm">Connection closed.</p>
          ) : showConnecting ? (
            <p className="text-muted-foreground animate-pulse text-sm">Connecting…</p>
          ) : connection.status === "connected" && !sessionMeta ? (
            <p className="text-muted-foreground text-sm">Waiting for data…</p>
          ) : (
            <>
              <div className="font-display text-xl font-semibold leading-tight tracking-tight text-[#e0e2ea]">
                {primaryLine.length > 0 ? (
                  primaryLine
                ) : (
                  <span className="text-muted-foreground font-normal">Waiting for data…</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${trackBadge.className}`}>
                  Track: {trackBadge.label}
                </span>
                {track?.TIMESTATE !== undefined && String(track.TIMESTATE) !== "" ? (
                  <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs">
                    Time state: {String(track.TIMESTATE)}
                  </span>
                ) : null}
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {countdown ? "Remaining: " : "End: "}
                  {endTimeDisplay(track, connection.remoteTimeDiffMs, nowMs)}
                </span>
              </div>
            </>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-2 self-start pt-0.5"
          title={`Live connection: ${connUi.label}`}
          role="status"
          aria-live="polite"
        >
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${connUi.dotClass}`} aria-hidden />
          <span className={`text-xs font-medium ${connUi.labelClass}`}>{connUi.label}</span>
        </div>
      </div>
    </header>
  )
}
