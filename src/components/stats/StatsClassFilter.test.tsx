import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Pid9002Frame } from "@/domain"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

import { StatsClassFilter } from "./StatsClassFilter"

function statsWithClasses(classes: string[]): Pid9002Frame {
  return {
    PID: "9002",
    LEADING: classes.map((cls) => ({ CLASS: cls })),
  } as unknown as Pid9002Frame
}

describe("StatsClassFilter", () => {
  const initialLive = useLiveStore.getState()

  beforeEach(() => {
    useLiveStore.setState({ ...initialLive, statistics: null })
    useFilterStore.setState({ excludedStatsClasses: new Set() })
  })

  afterEach(() => {
    useLiveStore.setState({ ...initialLive, statistics: null })
    useFilterStore.setState({ excludedStatsClasses: new Set() })
  })

  it("renders nothing when statistics is null", () => {
    const { container } = render(<StatsClassFilter />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when statistics has no derivable classes", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        LEADING: [{ CLASS: "TOTAL" }, { CLASS: "" }],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<StatsClassFilter />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the German label and a chip per derived class", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "SP-Pro", "Cup3"]),
    })

    render(<StatsClassFilter />)
    expect(screen.getByText("Filter_Klasse:")).toBeTruthy()

    const chips = screen.getAllByRole("switch")
    expect(chips).toHaveLength(3)
    expect(chips.map((c) => c.textContent)).toEqual(["Cup3", "SP-Pro", "SP9"])
  })

  it("marks every chip as aria-checked='true' when nothing is excluded", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)
    for (const chip of screen.getAllByRole("switch")) {
      expect(chip.getAttribute("aria-checked")).toBe("true")
    }
  })

  it("toggles the class in useFilterStore.excludedStatsClasses on click", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)
    const sp9 = screen.getByRole("switch", { name: /SP9/ })

    expect(useFilterStore.getState().excludedStatsClasses.has("SP9")).toBe(false)

    fireEvent.click(sp9)
    expect(useFilterStore.getState().excludedStatsClasses.has("SP9")).toBe(true)

    fireEvent.click(sp9)
    expect(useFilterStore.getState().excludedStatsClasses.has("SP9")).toBe(false)
  })

  it("renders an excluded chip with aria-checked='false' and line-through opacity styling", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })
    useFilterStore.setState({ excludedStatsClasses: new Set(["SP9"]) })

    render(<StatsClassFilter />)
    const sp9 = screen.getByRole("switch", { name: /SP9/ })
    const cup3 = screen.getByRole("switch", { name: /Cup3/ })

    expect(sp9.getAttribute("aria-checked")).toBe("false")
    expect(sp9.className).toContain("line-through")
    expect(sp9.className).toContain("opacity-60")

    expect(cup3.getAttribute("aria-checked")).toBe("true")
    expect(cup3.className).not.toContain("line-through")
  })

  it("does not render the reset button when nothing is excluded", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)
    expect(screen.queryByTestId("stats-class-filter-reset")).toBeNull()
  })

  it("renders the reset button when at least one class is excluded", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })
    useFilterStore.setState({ excludedStatsClasses: new Set(["SP9"]) })

    render(<StatsClassFilter />)
    const reset = screen.getByTestId("stats-class-filter-reset")
    expect(reset.textContent).toBe("Zurücksetzen")
  })

  it("clears excludedStatsClasses on reset click and hides the button", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })
    useFilterStore.setState({
      excludedStatsClasses: new Set(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)
    fireEvent.click(screen.getByTestId("stats-class-filter-reset"))

    expect(useFilterStore.getState().excludedStatsClasses.size).toBe(0)
    expect(screen.queryByTestId("stats-class-filter-reset")).toBeNull()
  })

  it("exposes the section's aria-label", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9"]),
    })

    const { container } = render(<StatsClassFilter />)
    const section = container.querySelector("section")
    expect(section?.getAttribute("aria-label")).toBe("Klassen filtern")
  })

  it("wraps the chip row in a relative section with a fade-masked scroll container", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)

    const section = screen.getByTestId("stats-class-filter")
    expect(section.tagName).toBe("SECTION")
    expect(section.className).toContain("relative")

    const row = screen.getByTestId("stats-class-filter-row")
    expect(row.className).toContain("overflow-x-auto")
    expect(row.className).toContain("no-scrollbar")
    expect(row.className).toContain("[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]")
    expect(row.className).toContain("lg:[mask-image:none]")
  })

  it("still toggles a chip after the wrapper restructure", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: statsWithClasses(["SP9", "Cup3"]),
    })

    render(<StatsClassFilter />)
    const cup3 = screen.getByRole("switch", { name: /Cup3/ })

    expect(useFilterStore.getState().excludedStatsClasses.has("Cup3")).toBe(false)
    fireEvent.click(cup3)
    expect(useFilterStore.getState().excludedStatsClasses.has("Cup3")).toBe(true)
  })
})
