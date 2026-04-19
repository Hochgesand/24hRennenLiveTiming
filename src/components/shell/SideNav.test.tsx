import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SideNav } from "./SideNav"

describe("SideNav", () => {
  const noop = () => {}

  it("renders the STRAT_OFFICER_01 heading and Green Hell Control subtitle", () => {
    render(<SideNav activeTab="stats" onSelect={noop} />)
    expect(screen.getByRole("heading", { name: "STRAT_OFFICER_01" })).toBeTruthy()
    expect(screen.getByText("Green Hell Control")).toBeTruthy()
  })

  it("renders 6 nav items in the F3 order when stqVisible is true", () => {
    const { container } = render(
      <SideNav activeTab="stats" onSelect={noop} stqVisible />
    )
    const aside = container.querySelector("aside")
    expect(aside).not.toBeNull()
    const navButtons = within(aside!)
      .getAllByRole("button")
      .filter((b) => b.textContent !== "LIVE FEED")
    expect(navButtons).toHaveLength(6)
    const labels = navButtons.map((b) => b.textContent?.trim())
    expect(labels).toEqual([
      expect.stringContaining("Cockpit"),
      expect.stringContaining("Rangliste"),
      expect.stringContaining("Statistik"),
      expect.stringContaining("Streckenkarte"),
      expect.stringContaining("Top-Qualifying"),
      expect.stringContaining("Meldungen"),
    ])
  })

  it("hides Top-Qualifying when stqVisible defaults to false", () => {
    const { container } = render(<SideNav activeTab="stats" onSelect={noop} />)
    const aside = container.querySelector("aside")
    const navButtons = within(aside!)
      .getAllByRole("button")
      .filter((b) => b.textContent !== "LIVE FEED")
    expect(navButtons).toHaveLength(5)
    expect(within(aside!).queryByText("Top-Qualifying")).toBeNull()
  })

  it("marks Statistik as the active item when activeTab='stats'", () => {
    render(<SideNav activeTab="stats" onSelect={noop} />)
    const statistik = screen.getByRole("button", { name: /Statistik/ })
    expect(statistik.getAttribute("aria-current")).toBe("page")
    expect(statistik.className).toContain("bg-red-600/10")
    expect(statistik.className).toContain("text-red-600")
    expect(statistik.className).toContain("border-l-4")
    expect(statistik.className).toContain("border-red-600")
  })

  it("when activeTab='leaderboard', Rangliste is active and Cockpit is NOT (per TODO)", () => {
    render(<SideNav activeTab="leaderboard" onSelect={noop} />)
    const rangliste = screen.getByRole("button", { name: /Rangliste/ })
    const cockpit = screen.getByRole("button", { name: /Cockpit/ })
    expect(rangliste.getAttribute("aria-current")).toBe("page")
    expect(rangliste.className).toContain("bg-red-600/10")
    expect(cockpit.getAttribute("aria-current")).toBeNull()
    expect(cockpit.className).not.toContain("bg-red-600/10")
  })

  it("clicking the Statistik button calls onSelect with 'stats'", () => {
    const onSelect = vi.fn()
    render(<SideNav activeTab="leaderboard" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("button", { name: /Statistik/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("stats")
  })

  it("clicking LIVE FEED calls onLiveFeedClick when provided", () => {
    const onLiveFeedClick = vi.fn()
    render(
      <SideNav activeTab="stats" onSelect={noop} onLiveFeedClick={onLiveFeedClick} />
    )
    fireEvent.click(screen.getByRole("button", { name: "LIVE FEED" }))
    expect(onLiveFeedClick).toHaveBeenCalledTimes(1)
  })

  it("clicking LIVE FEED does not throw when onLiveFeedClick is absent", () => {
    render(<SideNav activeTab="stats" onSelect={noop} />)
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "LIVE FEED" }))
    ).not.toThrow()
  })

  it("each nav item span carries the F3 data-icon mapping", () => {
    render(<SideNav activeTab="stats" onSelect={noop} stqVisible />)
    const expected: Array<[RegExp, string]> = [
      [/Cockpit/, "dashboard"],
      [/Rangliste/, "leaderboard"],
      [/Statistik/, "analytics"],
      [/Streckenkarte/, "map"],
      [/Top-Qualifying/, "flag"],
      [/Meldungen/, "notifications"],
    ]
    for (const [name, icon] of expected) {
      const button = screen.getByRole("button", { name })
      const iconSpan = button.querySelector("span.material-symbols-outlined")
      expect(iconSpan).not.toBeNull()
      expect(iconSpan?.getAttribute("data-icon")).toBe(icon)
    }
  })

  it("appends the optional className to the aside", () => {
    const { container } = render(
      <SideNav activeTab="stats" onSelect={noop} className="extra-class" />
    )
    const aside = container.querySelector("aside")
    expect(aside?.className).toContain("extra-class")
    expect(aside?.className).toContain("w-64")
  })
})
