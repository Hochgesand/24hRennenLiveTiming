/**
 * StatsTabSection behaviour tests — PRD-statistics-cockpit.md
 * §"Empty / loading / error states" items 1 + 3.
 *
 * Child bands (KpiStrip / ClassFilter / BestLapPerClassChart / SectorHeatmap /
 * LeadingTable) internally call `useBreakpoint`; we mock it so the tests drive
 * a deterministic breakpoint regardless of jsdom's window size. The section
 * itself takes `bp` as a prop, but threading the same value into the mock
 * keeps child renders consistent.
 */
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid9002Frame } from "@/domain"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

let mockBreakpoint: Breakpoint = "desktop"
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}))

import { StatsTabSection } from "./StatsTabSection"

const POPULATED_STATS = {
  PID: "9002",
  LEADING: [
    { CLASS: "SP9", NR: "911", LAPS: "124", GAP: "", SUM: "16:41:22.401", FROMLAP: 142 },
    { CLASS: "SP-X", NR: "706", LAPS: "122", GAP: "+2 Laps", SUM: "16:42:01.884", FROMLAP: 138 },
  ],
  BESTLAPS: [
    { CLASS: "SP9", NR: "911", LAPTIME: "8:12.345", DAYTIME: "13:22:11" },
    { CLASS: "SP-X", NR: "706", LAPTIME: "8:30.111", DAYTIME: "13:44:02" },
  ],
  BESTSECTORS: [
    { CLASS: "SP9", NR: "911", LAPTIME: "8:12.345", S1: "1:40.100", S2: "1:35.200" },
    { CLASS: "SP-X", NR: "706", LAPTIME: "8:30.111", S1: "1:42.222", S2: "1:37.500" },
  ],
} as unknown as Pid9002Frame

function setConnection(overrides: {
  status?: "idle" | "connecting" | "connected" | "error" | "closed"
  error?: string | null
  reconnecting?: boolean
}): void {
  const current = useLiveStore.getState().connection
  useLiveStore.setState({
    connection: {
      ...current,
      status: overrides.status ?? current.status,
      error: overrides.error ?? null,
      reconnecting: overrides.reconnecting ?? false,
    },
  })
}

describe("StatsTabSection", () => {
  const initialLive = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()

  beforeEach(() => {
    mockBreakpoint = "desktop"
    useLiveStore.setState({
      ...initialLive,
      statistics: null,
      sessionMeta: null,
      connection: {
        ...initialLive.connection,
        status: "connected",
        error: null,
        reconnecting: false,
      },
    })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
  })

  afterEach(() => {
    mockBreakpoint = "desktop"
    useLiveStore.setState({
      ...initialLive,
      statistics: null,
      sessionMeta: null,
      connection: {
        ...initialLive.connection,
        status: "idle",
        error: null,
        reconnecting: false,
      },
    })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
  })

  it("skeleton (statistics === null, connected): renders the single loading line, KPI strip, no chart / heatmap / table / class filter", () => {
    const { container } = render(<StatsTabSection bp="desktop" />)

    const loading = screen.getByTestId("stats-loading")
    expect(loading.textContent).toBe("Statistik wird geladen…")
    expect(loading.getAttribute("role")).toBe("status")
    expect(loading.getAttribute("aria-live")).toBe("polite")

    expect(container.querySelector('[data-testid="kpi-card"]')).not.toBeNull()
    expect(
      container.querySelector('[data-testid="best-lap-per-class-chart"]')
    ).toBeNull()
    expect(
      container.querySelector('[data-testid="sector-heatmap"]')
    ).toBeNull()
    expect(container.querySelector('[data-testid="leading-table"]')).toBeNull()
    expect(
      container.querySelector('[data-testid="stats-class-filter"]')
    ).toBeNull()
  })

  it("populated (statistics has rows, connected): renders the three bands and hides the loading line", () => {
    useLiveStore.setState({ statistics: POPULATED_STATS })

    const { container } = render(<StatsTabSection bp="desktop" />)

    expect(container.querySelector('[data-testid="stats-loading"]')).toBeNull()
    expect(
      container.querySelector('[data-testid="best-lap-per-class-chart"]')
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="sector-heatmap"]')
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="leading-table"]')
    ).not.toBeNull()
  })

  it("reconnecting + populated: wrapper carries opacity-60 and data-reconnecting=true", () => {
    useLiveStore.setState({ statistics: POPULATED_STATS })
    setConnection({ status: "connecting", reconnecting: true })

    const { container } = render(<StatsTabSection bp="desktop" />)
    const section = container.querySelector<HTMLDivElement>(
      '[data-testid="stats-tab-section"]'
    )
    expect(section).not.toBeNull()
    expect(section!.getAttribute("data-reconnecting")).toBe("true")
    expect(section!.className).toContain("opacity-60")
    expect(section!.className).toContain("transition-opacity")
    expect(section!.className).toContain("duration-200")
  })

  it("reconnecting + skeleton: dim is applied AND the skeleton loading line is shown", () => {
    setConnection({ status: "connecting", reconnecting: true })

    const { container } = render(<StatsTabSection bp="desktop" />)
    const section = container.querySelector<HTMLDivElement>(
      '[data-testid="stats-tab-section"]'
    )
    expect(section!.className).toContain("opacity-60")
    expect(screen.getByTestId("stats-loading")).toBeTruthy()
  })

  it("connected (not reconnecting): wrapper is opacity-100 and data-reconnecting=false", () => {
    useLiveStore.setState({ statistics: POPULATED_STATS })

    const { container } = render(<StatsTabSection bp="desktop" />)
    const section = container.querySelector<HTMLDivElement>(
      '[data-testid="stats-tab-section"]'
    )
    expect(section!.getAttribute("data-reconnecting")).toBe("false")
    expect(section!.className).toContain("opacity-100")
    expect(section!.className).not.toContain("opacity-60")
  })

  it("skeleton on mobile: StatsSubTabs is not rendered", () => {
    mockBreakpoint = "mobile"

    const { container } = render(<StatsTabSection bp="mobile" />)

    expect(container.querySelector('[role="tablist"]')).toBeNull()
    expect(screen.getByTestId("stats-loading")).toBeTruthy()
  })

  it("skeleton on desktop: StatsSubTabs IS rendered", () => {
    const { container } = render(<StatsTabSection bp="desktop" />)
    expect(container.querySelector('[role="tablist"]')).not.toBeNull()
  })
})
