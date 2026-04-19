import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useLiveStore } from "@/store/useLiveStore"

import { LiveStateRibbon } from "./LiveStateRibbon"

describe("LiveStateRibbon", () => {
  const initialState = useLiveStore.getState()

  beforeEach(() => {
    useLiveStore.setState({
      ...initialState,
      connection: {
        status: "idle",
        error: null,
        reconnecting: false,
        remoteTimeDiffMs: 0,
      },
    })
  })

  it("wraps content in a role=status container", () => {
    render(<LiveStateRibbon />)
    expect(screen.getByRole("status")).toBeTruthy()
  })

  it("renders the connected label with a pulsing red dot when status is connected", () => {
    useLiveStore.setState({
      connection: { status: "connected", reconnecting: false, error: null, remoteTimeDiffMs: 0 },
    })
    render(<LiveStateRibbon />)
    expect(screen.getByText("LIVE_TELEMETRY_STREAM_CONNECTED")).toBeTruthy()
    const dot = screen.getByRole("status").querySelector("span[aria-hidden='true']")
    expect(dot?.className).toContain("bg-red-600")
    expect(dot?.className).toContain("animate-pulse")
  })

  it("renders the connecting label when status is connecting", () => {
    useLiveStore.setState({
      connection: { status: "connecting", reconnecting: false, error: null, remoteTimeDiffMs: 0 },
    })
    render(<LiveStateRibbon />)
    expect(screen.getByText("LIVE_TELEMETRY_STREAM_CONNECTING…")).toBeTruthy()
    const dot = screen.getByRole("status").querySelector("span[aria-hidden='true']")
    expect(dot?.className).toContain("bg-amber-400")
    expect(dot?.className).toContain("animate-pulse")
  })

  it("renders the reconnecting label when reconnecting is true regardless of status", () => {
    useLiveStore.setState({
      connection: { status: "connected", reconnecting: true, error: null, remoteTimeDiffMs: 0 },
    })
    render(<LiveStateRibbon />)
    expect(screen.getByText("LIVE_TELEMETRY_STREAM_RECONNECTING…")).toBeTruthy()
  })

  it("renders the offline label and appended error when status is error", () => {
    useLiveStore.setState({
      connection: {
        status: "error",
        reconnecting: false,
        error: "WS closed 1006",
        remoteTimeDiffMs: 0,
      },
    })
    render(<LiveStateRibbon />)
    expect(
      screen.getByText("LIVE_TELEMETRY_STREAM_OFFLINE · WS closed 1006")
    ).toBeTruthy()
    const dot = screen.getByRole("status").querySelector("span[aria-hidden='true']")
    expect(dot?.className).toContain("bg-zinc-600")
    expect(dot?.className).not.toContain("animate-pulse")
  })

  it("renders the offline label with a static dot when status is closed", () => {
    useLiveStore.setState({
      connection: { status: "closed", reconnecting: false, error: null, remoteTimeDiffMs: 0 },
    })
    render(<LiveStateRibbon />)
    expect(screen.getByText("LIVE_TELEMETRY_STREAM_OFFLINE")).toBeTruthy()
    const dot = screen.getByRole("status").querySelector("span[aria-hidden='true']")
    expect(dot?.className).toContain("bg-zinc-600")
    expect(dot?.className).not.toContain("animate-pulse")
  })
})
