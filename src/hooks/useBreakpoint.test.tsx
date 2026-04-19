import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useBreakpoint } from "./useBreakpoint"

describe("useBreakpoint", () => {
  const listeners = new Set<() => void>()

  beforeEach(() => {
    listeners.clear()
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (_: string, cb: EventListener) => {
          listeners.add(cb as () => void)
        },
        removeEventListener: (_: string, cb: EventListener) => {
          listeners.delete(cb as () => void)
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setWidth(w: number) {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w })
    for (const cb of listeners) {
      cb()
    }
  }

  it("returns mobile for narrow viewport", () => {
    setWidth(400)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe("mobile")
  })

  it("returns tablet for mid viewport", () => {
    setWidth(900)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe("tablet")
  })

  it("returns desktop for wide viewport", () => {
    setWidth(1400)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe("desktop")
  })
})
