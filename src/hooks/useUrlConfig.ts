import { useMemo, useSyncExternalStore } from "react"

export type UiLang = "de" | "en"

export type AppTab =
  | "leaderboard"
  | "stats"
  | "messages"
  | "trackmap"
  | "stq"
  | "settings"

export type UrlConfig = {
  eventId: string | null
  config: string | null
  lang: UiLang
  tab: AppTab
}

const DEFAULT_LANG: UiLang = "de"
const DEFAULT_TAB: AppTab = "leaderboard"

const APP_TABS: ReadonlySet<string> = new Set([
  "leaderboard",
  "stats",
  "messages",
  "trackmap",
  "stq",
  "settings",
])

function parseLang(raw: string | null): UiLang {
  if (raw === "en" || raw === "de") {
    return raw
  }
  return DEFAULT_LANG
}

function parseTab(raw: string | null): AppTab {
  if (raw && APP_TABS.has(raw)) {
    return raw as AppTab
  }
  return DEFAULT_TAB
}

export function parseUrlConfig(search: string): UrlConfig {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const event = params.get("event")
  return {
    eventId: event && event.length > 0 ? event : null,
    config: params.get("config"),
    lang: parseLang(params.get("lang")),
    tab: parseTab(params.get("tab")),
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

function getSearchSnapshot(): string {
  return window.location.search
}

function getServerSearchSnapshot(): string {
  return ""
}

/** Reads URL query: `event`, `config`, `lang`, `tab`. */
export function useUrlConfig(): UrlConfig {
  const search = useSyncExternalStore(subscribe, getSearchSnapshot, getServerSearchSnapshot)
  return useMemo(() => parseUrlConfig(search), [search])
}
