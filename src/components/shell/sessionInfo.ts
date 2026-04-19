/**
 * Pure helpers for session-info display in the app shell.
 *
 * Extracted from the legacy `src/components/SessionHeader.tsx` so that the
 * new `BrandTopBar` and any future shell consumers can render the same
 * connection / track-state / countdown labels without duplicating logic.
 *
 * No React, no zustand, no DOM — these are deterministic transforms that
 * map wire-frame data to display strings + Tailwind class hints.
 */
import type { Pid4Frame } from "@/domain"
import type { ConnectionStatus } from "@/store/useLiveStore"

export type ConnectionUi = {
  dotClass: string
  labelClass: string
  label: string
}

export type TrackBadge = {
  label: string
  className: string
}

export function connectionUi(
  status: ConnectionStatus,
  reconnecting: boolean,
  t: (key: string) => string
): ConnectionUi {
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

export function formatMmSs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function trackStateLabel(
  raw: string | undefined,
  t: (key: string) => string
): TrackBadge {
  const key = raw === undefined ? "" : String(raw).trim()
  const n = Number.parseInt(key, 10)
  if (!Number.isNaN(n)) {
    switch (n) {
      case 0:
        return {
          label: t("track.green"),
          className:
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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

export function endTimeDisplay(
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

export function isTimeStateCountdown(track: Pid4Frame | null): boolean {
  if (!track) {
    return false
  }
  return String(track.TIMESTATE ?? "") === "0"
}
