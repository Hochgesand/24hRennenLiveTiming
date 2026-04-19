import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Pid9002Frame } from "@/domain"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

import { StatsKpiStrip } from "./StatsKpiStrip"

describe("StatsKpiStrip", () => {
  const initial = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()

  beforeEach(() => {
    useLiveStore.setState({ ...initial, statistics: null })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
  })

  afterEach(() => {
    useLiveStore.setState({ ...initial, statistics: null })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
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

  it("renders all four cards as em-dashes with the skeleton waiting sub when statistics is null", () => {
    const { container } = render(<StatsKpiStrip />)
    const cards = container.querySelectorAll('[data-testid="kpi-card"]')
    expect(cards.length).toBe(4)
    for (const card of Array.from(cards)) {
      const valueEl = card.querySelector(".font-mono")
      expect(valueEl?.textContent).toBe("—")
    }
    // Card 1 (fastest lap) and card 4 (active classes) carry the skeleton sub.
    expect(screen.getAllByText("Warte auf PID 9002").length).toBe(2)
    // The two structural sub literals stay even in skeleton state.
    expect(screen.getByText("TOTAL COMBINED")).toBeTruthy()
    expect(screen.getByText("POTENZIAL")).toBeTruthy()
  })

  it("marks the section as data-state='skeleton' with animate-pulse when statistics is null", () => {
    const { container } = render(<StatsKpiStrip />)
    const section = container.querySelector("section")
    expect(section).not.toBeNull()
    expect(section?.getAttribute("data-state")).toBe("skeleton")
    expect(section?.className).toContain("animate-pulse")
    expect(section?.className).toContain("opacity-80")
  })

  it("flips data-state to 'ready' and drops animate-pulse when live data arrives", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [{ CLASS: "SP9", NR: "911", LAPTIME: "7:54.218" }],
        LEADING: [{ CLASS: "SP9", NR: "911" }],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<StatsKpiStrip />)
    const section = container.querySelector("section")
    expect(section?.getAttribute("data-state")).toBe("ready")
    expect(section?.className).not.toContain("animate-pulse")
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

  it("renders the active-classes KPI with distinct LEADING classes and raw count", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        LEADING: [
          { CLASS: "SP9", NR: "911" },
          { CLASS: "SP9" },
          { CLASS: "SP-Pro" },
          { CLASS: "TOTAL" },
          { CLASS: "Cup3" },
        ],
      } as unknown as Pid9002Frame,
    })

    render(<StatsKpiStrip />)
    expect(screen.getByText("Aktive Klassen")).toBeTruthy()

    const sub = screen.getByText("5 LEADING")
    expect(sub).toBeTruthy()
    expect(sub.className).toContain("text-tertiary")

    const card = sub.closest('[data-testid="kpi-card"]')
    expect(card).not.toBeNull()
    expect(card?.className).toContain("border-tertiary-container")

    const valueEl = card?.querySelector(".font-mono")
    expect(valueEl?.textContent).toBe("3")
  })

  it("renders every KPI value cell mono-formatted per the formatting contract (PRD §KPI strip item 5)", () => {
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
        LEADING: [
          { CLASS: "SP9", NR: "911" },
          { CLASS: "SP-Pro" },
          { CLASS: "Cup3" },
        ],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<StatsKpiStrip />)
    const cards = container.querySelectorAll('[data-testid="kpi-card"]')
    expect(cards.length).toBe(4)

    // m:ss.SSS  |  ±m:ss.SSS s (with U+2212 minus or +)  |  bare integer  |  em-dash
    const VALUE_RE =
      /^(?:[+\u2212]?\d+(?::\d{2})?\.\d{3}\s?s?|\d+|\u2014)$/

    for (const card of Array.from(cards)) {
      const valueEl = card.querySelector(".font-mono")
      expect(valueEl).not.toBeNull()
      const txt = valueEl?.textContent ?? ""
      expect(VALUE_RE.test(txt)).toBe(true)
      // ASCII hyphen "-" (U+002D) is forbidden as a fallback glyph; only U+2014 em-dash allowed.
      expect(txt).not.toBe("\u002d")
    }
  })

  it("renders the active-classes KPI with value '—' and the skeleton sub when statistics is null", () => {
    render(<StatsKpiStrip />)

    // Two cards carry the skeleton sub literal; pick the tertiary-accented one.
    const subs = screen.getAllByText("Warte auf PID 9002")
    const sub = subs.find((node) => node.className.includes("text-tertiary"))
    expect(sub).toBeTruthy()

    const card = sub?.closest('[data-testid="kpi-card"]')
    expect(card).not.toBeNull()
    expect(card?.className).toContain("border-tertiary-container")

    const valueEl = card?.querySelector(".font-mono")
    expect(valueEl?.textContent).toBe("—")

    // Regression: the legacy "KEINE DATEN" / "0" combo must not render in the
    // null-stats case anymore — that's the skeleton story (PRD §KPI strip 6).
    expect(screen.queryByText("KEINE DATEN")).toBeNull()
    expect(screen.queryByText("0 LEADING")).toBeNull()
  })

  it("reflects useFilterStore.excludedStatsClasses in the KPI cards (PRD class-filter band item 5)", () => {
    useLiveStore.setState({
      ...initial,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "7:30.000" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
        LEADING: [
          { CLASS: "SP9", NR: "100" },
          { CLASS: "SP-Pro", NR: "911" },
          { CLASS: "Cup3", NR: "55" },
        ],
      } as unknown as Pid9002Frame,
    })

    const { rerender } = render(<StatsKpiStrip />)

    // Baseline: no exclusions → SP9 wins fastest lap, 3 active classes.
    expect(screen.getByText("7:30.000")).toBeTruthy()
    const baselineSub = screen.getByText(/#100/)
    expect(baselineSub.textContent).toContain("SP9")
    expect(screen.getByText("3 LEADING")).toBeTruthy()

    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["SP9"]),
    })
    rerender(<StatsKpiStrip />)

    // After excluding SP9: Cup3 owns the fastest lap and only 2 classes remain.
    expect(screen.getByText("7:59.001")).toBeTruthy()
    const filteredSub = screen.getByText(/#55/)
    expect(filteredSub.textContent).toContain("Cup3")
    expect(screen.getByText("2 LEADING")).toBeTruthy()

    const cards = screen.getAllByTestId("kpi-card")
    const activeClassesCard = cards[3]
    const valueEl = activeClassesCard.querySelector(".font-mono")
    expect(valueEl?.textContent).toBe("2")
  })
})
