import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HIGHLIGHT_CLASS, scrollToLeadingClass } from "./uiInteractions"

describe("scrollToLeadingClass", () => {
  let scrollSpy: ReturnType<typeof vi.fn>
  const originalScrollIntoView = Element.prototype.scrollIntoView
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    scrollSpy = vi.fn()
    Element.prototype.scrollIntoView =
      scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    Element.prototype.scrollIntoView = originalScrollIntoView
    window.matchMedia = originalMatchMedia
    document.body.innerHTML = ""
  })

  function seedRow(classLabel: string): HTMLElement {
    document.body.innerHTML = `<table><tbody><tr data-testid="leading-row" data-class="${classLabel}" data-nr="42"></tr></tbody></table>`
    return document.querySelector<HTMLElement>(
      `[data-testid="leading-row"][data-class="${classLabel}"]`
    )!
  }

  it("no-ops when no matching row exists", () => {
    document.body.innerHTML = ""
    scrollToLeadingClass("SP9")
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("scrolls the matching row into view", () => {
    seedRow("SP9")
    scrollToLeadingClass("SP9")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    })
  })

  it("adds the highlight class then removes it after 1500 ms", () => {
    const row = seedRow("SP9")
    scrollToLeadingClass("SP9")
    expect(row.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
    vi.advanceTimersByTime(1499)
    expect(row.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
    vi.advanceTimersByTime(1)
    expect(row.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
  })

  it("escapes class labels with special characters (e.g. SP-X)", () => {
    const row = seedRow("SP-X")
    scrollToLeadingClass("SP-X")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(row.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
  })

  it("uses behavior:'auto' under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList)
    seedRow("SP9")
    scrollToLeadingClass("SP9")
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    })
  })
})
