import { useMemo, useSyncExternalStore } from "react"

export type UrlConfig = {
  eventId: string | null
  config: string | null
}

export function parseUrlConfig(search: string): UrlConfig {
  const params = new URLSearchParams(search)
  const event = params.get("event")
  return {
    eventId: event && event.length > 0 ? event : null,
    config: params.get("config"),
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

/** Reads `?event=` and `?config=` from the current location (no router). */
export function useUrlConfig(): UrlConfig {
  const search = useSyncExternalStore(subscribe, getSearchSnapshot, getServerSearchSnapshot)
  return useMemo(() => parseUrlConfig(search), [search])
}
