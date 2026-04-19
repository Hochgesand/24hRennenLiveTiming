import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useLiveStore } from "@/store/useLiveStore"

vi.mock("@/hooks/useLiveConnection", () => ({
  useLiveConnection: () => ({ missingEvent: true }),
}))

vi.mock("@/hooks/useSyncFiltersFromUrl", () => ({
  useSyncFiltersFromUrl: () => {},
}))

// jsdom does not implement matchMedia. AppShellRouter / AppShell depend on
// useBreakpoint -> window.matchMedia. Provide a minimal polyfill so React's
// useSyncExternalStore has a stable subscribe.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

import App from "./App"
import { isEventNotFoundError } from "@/lib/connectionError"

describe("isEventNotFoundError", () => {
  it("is true only for the WIGE LTS_NOT_FOUND signal 'event not found'", () => {
    expect(isEventNotFoundError("event not found")).toBe(true)
    expect(isEventNotFoundError("  EVENT NOT FOUND  ")).toBe(true)
    expect(isEventNotFoundError(null)).toBe(false)
    expect(isEventNotFoundError("")).toBe(false)
    expect(isEventNotFoundError("boom")).toBe(false)
    expect(isEventNotFoundError("websocket error")).toBe(false)
  })
})

describe("App — LTS_NOT_FOUND priority (PRD § Empty / loading / error states #2)", () => {
  const initialLive = useLiveStore.getState()

  beforeEach(() => {
    window.history.replaceState(null, "", "/?event=50&config=w3&tab=stats")
    useLiveStore.setState({
      ...initialLive,
      connection: {
        ...initialLive.connection,
        status: "error",
        error: null,
        reconnecting: false,
      },
    })
  })

  afterEach(() => {
    window.history.replaceState(null, "", "/")
    useLiveStore.setState({
      ...initialLive,
      connection: {
        ...initialLive.connection,
        status: "idle",
        error: null,
        reconnecting: false,
      },
    })
  })

  it("renders <EventNotFoundOverlay> and NOT the stats tab section when connection.error = 'event not found'", () => {
    useLiveStore.setState({
      ...initialLive,
      connection: {
        ...initialLive.connection,
        status: "error",
        error: "event not found",
        reconnecting: false,
      },
    })

    const { container } = render(<App />)

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(
      container.querySelector('[data-testid="stats-tab-section"]')
    ).toBeNull()
  })

  it("does NOT render <EventNotFoundOverlay> when connection.error is null, and the stats tab section mounts under tab=stats", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: null,
      connection: {
        ...initialLive.connection,
        status: "connected",
        error: null,
        reconnecting: false,
      },
    })

    const { container } = render(<App />)

    expect(container.querySelector("[role='alert']")).toBeNull()
    expect(
      container.querySelector('[data-testid="stats-tab-section"]')
    ).not.toBeNull()
  })
})
