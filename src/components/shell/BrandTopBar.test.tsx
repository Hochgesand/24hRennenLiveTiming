import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Pid0Frame, Pid4Frame } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

import { BrandTopBar } from "./BrandTopBar"

describe("BrandTopBar", () => {
  const initialUi = useUiStore.getState()
  const initialLive = useLiveStore.getState()

  beforeEach(() => {
    useUiStore.setState({ ...initialUi, settingsDrawerOpen: false })
    useLiveStore.setState({
      ...initialLive,
      sessionMeta: null,
      track: null,
      connection: { ...initialLive.connection, remoteTimeDiffMs: 0 },
    })
  })

  afterEach(() => {
    useUiStore.setState({ ...initialUi, settingsDrawerOpen: false })
    useLiveStore.setState({
      ...initialLive,
      sessionMeta: null,
      track: null,
      connection: { ...initialLive.connection, remoteTimeDiffMs: 0 },
    })
  })

  it("renders the brand text and caption", () => {
    render(<BrandTopBar />)
    expect(screen.getByText("LIVE TIMING")).toBeTruthy()
    expect(screen.getByText("24H NÜRBURGRING")).toBeTruthy()
  })

  it("brand text uses text-red-600", () => {
    render(<BrandTopBar />)
    const brand = screen.getByText("LIVE TIMING")
    expect(brand.className).toContain("text-red-600")
  })

  it("renders inside a header element with h-16 inner row", () => {
    const { container } = render(<BrandTopBar />)
    const header = container.querySelector("header")
    expect(header).not.toBeNull()
    const row = header?.querySelector("div")
    expect(row?.className).toContain("h-16")
  })

  it("clicking Settings calls setSettingsDrawerOpen(true)", () => {
    render(<BrandTopBar />)
    expect(useUiStore.getState().settingsDrawerOpen).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Settings" }))
    expect(useUiStore.getState().settingsDrawerOpen).toBe(true)
  })

  it("Search and Notifications buttons render with data-todo and do not throw on click", () => {
    render(<BrandTopBar />)
    const search = screen.getByRole("button", { name: "Search" })
    const notifications = screen.getByRole("button", { name: "Notifications" })

    expect(search.getAttribute("data-todo")).toBe("search")
    expect(notifications.getAttribute("data-todo")).toBe("notifications")

    expect(() => fireEvent.click(search)).not.toThrow()
    expect(() => fireEvent.click(notifications)).not.toThrow()

    expect(useUiStore.getState().settingsDrawerOpen).toBe(false)
  })

  it("hides the event caption and the status cluster when sessionMeta is null", () => {
    render(<BrandTopBar />)
    expect(screen.queryByTestId("brand-session-info")).toBeNull()
    expect(screen.queryByTestId("brand-session-status")).toBeNull()
  })

  it("renders the event caption when sessionMeta is set", () => {
    useLiveStore.setState({
      sessionMeta: {
        PID: "0",
        CUP: "ADAC",
        SESSION: "Race",
        HEAT: "1",
        TRACKNAME: "Nürburgring",
      } as Pid0Frame,
    })
    render(<BrandTopBar />)
    const caption = screen.getByTestId("brand-session-info")
    expect(caption.textContent).toBe("ADAC · Race · 1 · Nürburgring")
    expect(caption.className).toContain("text-zinc-400")
    expect(caption.className).toContain("hidden")
    expect(caption.className).toContain("md:inline")
    expect(caption.className).toContain("truncate")
  })

  it("renders the green track-state badge when TRACKSTATE='0'", () => {
    useLiveStore.setState({
      sessionMeta: { PID: "0", CUP: "ADAC" } as Pid0Frame,
      track: { PID: "4", TRACKSTATE: "0" } as Pid4Frame,
    })
    render(<BrandTopBar />)
    const badge = screen.getByTestId("brand-track-badge")
    expect(badge.className).toContain("emerald")
    expect(badge.textContent).toBeTruthy()
  })

  it("prefixes 'REM' to the countdown when TIMESTATE='0'", () => {
    useLiveStore.setState({
      sessionMeta: { PID: "0", CUP: "ADAC" } as Pid0Frame,
      track: {
        PID: "4",
        TRACKSTATE: "0",
        TIMESTATE: "0",
        ENDTIME: Date.now() + 60_000,
      } as Pid4Frame,
    })
    render(<BrandTopBar />)
    const countdown = screen.getByTestId("brand-countdown")
    expect(countdown.textContent?.startsWith("REM ")).toBe(true)
  })

  it("prefixes 'END' to the wall-clock when TIMESTATE!='0'", () => {
    useLiveStore.setState({
      sessionMeta: { PID: "0", CUP: "ADAC" } as Pid0Frame,
      track: {
        PID: "4",
        TRACKSTATE: "0",
        TIMESTATE: "1",
        ENDTIME: Date.UTC(2026, 3, 19, 12, 0, 0),
      } as Pid4Frame,
    })
    render(<BrandTopBar />)
    const countdown = screen.getByTestId("brand-countdown")
    expect(countdown.textContent?.startsWith("END ")).toBe(true)
  })
})
