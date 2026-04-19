import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Pid9002Frame } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"

import { StatsKpiStrip } from "./StatsKpiStrip"

describe("StatsKpiStrip", () => {
  const initial = useLiveStore.getState()

  beforeEach(() => {
    useLiveStore.setState({ ...initial, statistics: null })
  })

  afterEach(() => {
    useLiveStore.setState({ ...initial, statistics: null })
  })

  it("renders the German caption 'Schnellste Runde' by default", () => {
    render(<StatsKpiStrip />)
    expect(screen.getByText("Schnellste Runde")).toBeTruthy()
  })

  it("exposes the section's aria-label", () => {
    const { container } = render(<StatsKpiStrip />)
    const section = container.querySelector("section")
    expect(section).not.toBeNull()
    expect(section?.getAttribute("aria-label")).toBe("KPI-Übersicht")
  })

  it("renders an em-dash and the no-data sub line when statistics is null", () => {
    render(<StatsKpiStrip />)
    expect(screen.getByText("—")).toBeTruthy()
    expect(screen.getByText("Keine Daten")).toBeTruthy()
  })

  it("renders the fastest lap value and a sub line containing #NR and class", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("7:54.218")).toBeTruthy()
    const sub = screen.getByText(/#911/)
    expect(sub.textContent).toContain("#911")
    expect(sub.textContent).toContain("SP9")
  })
})
