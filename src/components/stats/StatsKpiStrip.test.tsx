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
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1)
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

  it("renders the theoretical-best value summed from BESTSECTORS TOTAL row", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTSECTORS: [
          {
            CLASS: "TOTAL",
            S1: "2:30.100",
            S2: "2:35.200",
            S3: "2:46.102",
          },
        ],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("7:51.402")).toBeTruthy()
    expect(screen.getByText("TOTAL COMBINED")).toBeTruthy()
    expect(screen.getByText("Theoretische Bestzeit")).toBeTruthy()
  })

  it("renders an em-dash for the theoretical-best card when no TOTAL row is present", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTSECTORS: [
          { CLASS: "SP9", S1: "2:30.100", S2: "2:35.200", S3: "2:46.102" },
        ],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("TOTAL COMBINED")).toBeTruthy()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1)
  })

  it("renders an em-dash for the theoretical-best card when TOTAL row has fewer than 2 parseable sectors", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTSECTORS: [{ CLASS: "TOTAL", S1: "2:30.100" }],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("TOTAL COMBINED")).toBeTruthy()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1)
  })

  it("renders both the fastest-lap and theoretical-best cards side by side", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
        BESTSECTORS: [
          {
            CLASS: "TOTAL",
            S1: "2:30.100",
            S2: "2:35.200",
            S3: "2:46.102",
          },
        ],
      } as Pid9002Frame,
    })

    const { container } = render(<StatsKpiStrip />)
    const cards = container.querySelectorAll('[data-testid="kpi-card"]')
    expect(cards.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("7:54.218")).toBeTruthy()
    expect(screen.getByText("7:51.402")).toBeTruthy()
  })

  it("renders the delta KPI card with positive sign and green accent when both inputs exist", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
        BESTSECTORS: [
          {
            CLASS: "TOTAL",
            S1: "2:30.100",
            S2: "2:35.200",
            S3: "2:46.102",
          },
        ],
      } as Pid9002Frame,
    })

    const { container } = render(<StatsKpiStrip />)
    const cards = container.querySelectorAll('[data-testid="kpi-card"]')
    expect(cards.length).toBe(4)

    const deltaValue = screen.getByText("+2.816 s")
    expect(deltaValue).toBeTruthy()
    expect(deltaValue.className).toContain("text-secondary")

    const deltaCard = deltaValue.closest('[data-testid="kpi-card"]')
    expect(deltaCard).not.toBeNull()
    expect(deltaCard?.className).toContain("border-secondary-container")
    expect(screen.getByText("Δ Real → Theoretisch")).toBeTruthy()
    expect(screen.getByText("POTENZIAL")).toBeTruthy()
  })

  it("renders an em-dash for the delta KPI when the fastest lap is missing", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTSECTORS: [
          {
            CLASS: "TOTAL",
            S1: "2:30.100",
            S2: "2:35.200",
            S3: "2:46.102",
          },
        ],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("Δ Real → Theoretisch")).toBeTruthy()
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it("renders an em-dash for the delta KPI when the theoretical best is missing", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
      } as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("Δ Real → Theoretisch")).toBeTruthy()
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
