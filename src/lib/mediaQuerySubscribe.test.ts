import { afterEach, describe, expect, it, vi } from "vitest"

import { subscribeMediaQueryChange } from "./mediaQuerySubscribe"

describe("subscribeMediaQueryChange", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses addEventListener when available", () => {
    const mq = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList

    const onChange = vi.fn()
    const unsub = subscribeMediaQueryChange(mq, onChange)

    expect(mq.addEventListener).toHaveBeenCalledWith("change", onChange)
    unsub()
    expect(mq.removeEventListener).toHaveBeenCalledWith("change", onChange)
  })

  it("falls back to addListener when addEventListener is missing", () => {
    const mq = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList

    const onChange = vi.fn()
    const unsub = subscribeMediaQueryChange(mq, onChange)

    expect(mq.addListener).toHaveBeenCalled()
    unsub()
    expect(mq.removeListener).toHaveBeenCalled()
  })
})
