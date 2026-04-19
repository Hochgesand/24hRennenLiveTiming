import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid3Frame } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"

import { useMessageToasts } from "./useMessageToasts"

const toastMock = vi.fn()

vi.mock("sonner", () => ({
  toast: (msg: unknown, opts?: unknown) => toastMock(msg, opts),
}))

function setMessages(frame: Pid3Frame | null) {
  act(() => {
    useLiveStore.getState().setMessages(frame)
  })
}

function pid3(messages: Array<{ ID?: string | number; MESSAGE?: string; MESSAGEGROUP?: string; MESSAGETIME?: string | number }>): Pid3Frame {
  return { PID: "3", MESSAGES: messages } as Pid3Frame
}

describe("useMessageToasts", () => {
  beforeEach(() => {
    toastMock.mockClear()
    useLiveStore.getState().setMessages(null)
  })

  afterEach(() => {
    useLiveStore.getState().setMessages(null)
  })

  it("does not toast historic messages from the first received frame", () => {
    renderHook(() => useMessageToasts())

    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start", MESSAGEGROUP: "RACE" },
        { ID: 2, MESSAGE: "Yellow flag" },
      ]),
    )

    expect(toastMock).not.toHaveBeenCalled()
  })

  it("toasts only newly added messages on subsequent frames", () => {
    renderHook(() => useMessageToasts())

    setMessages(pid3([{ ID: 1, MESSAGE: "Race start" }]))
    expect(toastMock).not.toHaveBeenCalled()

    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start" },
        { ID: 2, MESSAGE: "Safety car deployed", MESSAGEGROUP: "RC" },
      ]),
    )

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith(
      "Safety car deployed",
      expect.objectContaining({ id: "id:2", description: "RC" }),
    )
  })

  it("dedupes messages by ID across multiple frames", () => {
    renderHook(() => useMessageToasts())

    setMessages(pid3([{ ID: 1, MESSAGE: "Race start" }]))
    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start" },
        { ID: 2, MESSAGE: "Yellow flag" },
      ]),
    )
    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start" },
        { ID: 2, MESSAGE: "Yellow flag" },
      ]),
    )

    expect(toastMock).toHaveBeenCalledTimes(1)
  })

  it("skips messages with empty text", () => {
    renderHook(() => useMessageToasts())

    setMessages(pid3([{ ID: 1, MESSAGE: "Race start" }]))
    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start" },
        { ID: 2, MESSAGE: "  " },
        { ID: 3, MESSAGE: "Track clear" },
      ]),
    )

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith("Track clear", expect.any(Object))
  })

  it("resets the de-dup state when the messages frame is cleared (event switch)", () => {
    renderHook(() => useMessageToasts())

    setMessages(pid3([{ ID: 1, MESSAGE: "Race start" }]))
    setMessages(null)
    setMessages(pid3([{ ID: 1, MESSAGE: "Race start" }]))

    expect(toastMock).not.toHaveBeenCalled()

    setMessages(
      pid3([
        { ID: 1, MESSAGE: "Race start" },
        { ID: 2, MESSAGE: "Yellow flag" },
      ]),
    )
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith("Yellow flag", expect.any(Object))
  })

  it("falls back to time+text key when ID is missing", () => {
    renderHook(() => useMessageToasts())

    setMessages(pid3([{ MESSAGE: "Snapshot entry", MESSAGETIME: "10:00:00" }]))
    setMessages(
      pid3([
        { MESSAGE: "Snapshot entry", MESSAGETIME: "10:00:00" },
        { MESSAGE: "New entry", MESSAGETIME: "10:01:00" },
      ]),
    )

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith("New entry", expect.any(Object))
  })
})
