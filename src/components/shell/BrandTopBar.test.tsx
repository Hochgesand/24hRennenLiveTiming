import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useUiStore } from "@/store/useUiStore"

import { BrandTopBar } from "./BrandTopBar"

describe("BrandTopBar", () => {
  const initialState = useUiStore.getState()

  beforeEach(() => {
    useUiStore.setState({ ...initialState, settingsDrawerOpen: false })
  })

  afterEach(() => {
    useUiStore.setState({ ...initialState, settingsDrawerOpen: false })
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
})
