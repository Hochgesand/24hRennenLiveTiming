import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MobileBottomNav } from "./MobileBottomNav"

describe("MobileBottomNav", () => {
  it("renders four buttons with the Stitch German labels in order", () => {
    render(<MobileBottomNav active="leaderboard" onSelect={() => {}} />)
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(4)
    expect(buttons[0]?.textContent).toContain("Rennen")
    expect(buttons[1]?.textContent).toContain("Statistik")
    expect(buttons[2]?.textContent).toContain("Meldungen")
    expect(buttons[3]?.textContent).toContain("Setup")
  })

  it("renders the Stitch icon set in order via data-icon", () => {
    const { container } = render(
      <MobileBottomNav active="leaderboard" onSelect={() => {}} />
    )
    const icons = container.querySelectorAll<HTMLSpanElement>("span.material-symbols-outlined")
    expect(icons).toHaveLength(4)
    expect(icons[0]?.getAttribute("data-icon")).toBe("speed")
    expect(icons[1]?.getAttribute("data-icon")).toBe("leaderboard")
    expect(icons[2]?.getAttribute("data-icon")).toBe("notifications")
    expect(icons[3]?.getAttribute("data-icon")).toBe("settings")
  })

  it("marks the active tab with aria-current=page, Stitch active classes, and FILL=1 icon", () => {
    render(<MobileBottomNav active="stats" onSelect={() => {}} />)
    const statsBtn = screen.getByRole("button", { name: /Statistik/ })
    expect(statsBtn.getAttribute("aria-current")).toBe("page")
    expect(statsBtn.className).toContain("text-[#E30613]")
    expect(statsBtn.className).toContain("bg-[#2a2b2c]")
    expect(statsBtn.className).toContain("border-t-2")
    expect(statsBtn.className).toContain("border-[#E30613]")
    const icon = statsBtn.querySelector<HTMLSpanElement>("span.material-symbols-outlined")
    expect(icon?.style.fontVariationSettings).toBe("'FILL' 1")
  })

  it("does not mark inactive tabs with aria-current and uses the inactive class set", () => {
    render(<MobileBottomNav active="leaderboard" onSelect={() => {}} />)
    const statsBtn = screen.getByRole("button", { name: /Statistik/ })
    expect(statsBtn.hasAttribute("aria-current")).toBe(false)
    expect(statsBtn.className).not.toContain("text-[#E30613]")
    expect(statsBtn.className).not.toContain("bg-[#2a2b2c]")
    expect(statsBtn.className).toContain("text-gray-500")
    expect(statsBtn.className).toContain("opacity-60")
    const icon = statsBtn.querySelector<HTMLSpanElement>("span.material-symbols-outlined")
    expect(icon?.style.fontVariationSettings).toBe("")
  })

  it("invokes onSelect with the corresponding id when a non-active button is clicked", () => {
    const onSelect = vi.fn()
    render(<MobileBottomNav active="leaderboard" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("button", { name: /Meldungen/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("messages")
  })

  it("appends the optional className to the nav element", () => {
    const { container } = render(
      <MobileBottomNav active="leaderboard" onSelect={() => {}} className="extra-class" />
    )
    const nav = container.querySelector("nav")
    expect(nav?.className).toContain("extra-class")
    expect(nav?.className).toContain("fixed")
  })
})
