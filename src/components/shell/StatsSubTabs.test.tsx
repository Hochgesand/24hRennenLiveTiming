import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StatsSubTabs } from "./StatsSubTabs"

describe("StatsSubTabs", () => {
  it("renders the heading and caption verbatim per F2", () => {
    render(<StatsSubTabs />)
    expect(screen.getByRole("heading", { name: "STATISTICS_COCKPIT" })).toBeTruthy()
    expect(screen.getByText("TELEMETRY_ENGINE_V4.0")).toBeTruthy()
  })

  it("renders three role=tab buttons named Statistik, Verlauf, Delta_AI", () => {
    render(<StatsSubTabs />)
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(3)
    expect(screen.getByRole("tab", { name: "Statistik" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Verlauf" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Delta_AI" })).toBeTruthy()
  })

  it("Statistik tab is aria-selected", () => {
    render(<StatsSubTabs />)
    const statistik = screen.getByRole("tab", { name: "Statistik" })
    expect(statistik.getAttribute("aria-selected")).toBe("true")
  })

  it("Verlauf and Delta_AI carry aria-disabled, title, tabIndex=-1, and cursor-not-allowed", () => {
    render(<StatsSubTabs />)
    for (const name of ["Verlauf", "Delta_AI"] as const) {
      const tab = screen.getByRole("tab", { name })
      expect(tab.getAttribute("aria-disabled")).toBe("true")
      expect(tab.getAttribute("title")).toBe("Kommt in v2")
      expect(tab.getAttribute("tabindex")).toBe("-1")
      expect(tab.className).toContain("cursor-not-allowed")
    }
  })

  it("clicking Statistik invokes onSelect with 'statistik'", () => {
    const onSelect = vi.fn()
    render(<StatsSubTabs onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("tab", { name: "Statistik" }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("statistik")
  })

  it("clicking Statistik without onSelect does not throw", () => {
    render(<StatsSubTabs />)
    expect(() =>
      fireEvent.click(screen.getByRole("tab", { name: "Statistik" }))
    ).not.toThrow()
  })

  it("clicking disabled tabs does not invoke onSelect and does not throw", () => {
    const onSelect = vi.fn()
    render(<StatsSubTabs onSelect={onSelect} />)
    expect(() => fireEvent.click(screen.getByRole("tab", { name: "Verlauf" }))).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole("tab", { name: "Delta_AI" }))).not.toThrow()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("applies the optional className to the outer wrapper", () => {
    const { container } = render(<StatsSubTabs className="extra-class" />)
    const wrapper = container.firstChild as HTMLElement | null
    expect(wrapper?.className).toContain("extra-class")
    expect(wrapper?.className).toContain("flex")
  })
})
