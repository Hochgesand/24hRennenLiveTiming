import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useLapsDataSubscription } from "./useLapsDataSubscription"

/** Minimal fake WebSocket (defer open so `onopen` is wired). */
class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null

  readonly sent: string[] = []
  readonly url: string

  constructor(url: string) {
    this.url = url
    queueMicrotask(() => {
      if (this.readyState === MockWebSocket.CLOSED) return
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event("open"))
    })
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.sent.push(typeof data === "string" ? data : "")
  }

  emitMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent)
  }

  close(_code?: number, _reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent("close", { code: 1000 }))
  }
}

let lastMockInstance: MockWebSocket | null = null

function createMockCtor(): typeof WebSocket {
  return class extends MockWebSocket {
    constructor(url: string | URL) {
      super(String(url))
      lastMockInstance = this
    }
  } as unknown as typeof WebSocket
}

async function flushOpen(): Promise<MockWebSocket> {
  await Promise.resolve()
  const ws = lastMockInstance
  if (!ws) throw new Error("expected MockWebSocket instance")
  return ws
}

describe("useLapsDataSubscription", () => {
  beforeEach(() => {
    lastMockInstance = null
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"))
    const MockCtor = createMockCtor()
    vi.stubGlobal("WebSocket", MockCtor)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("stays idle when disabled", () => {
    const { result } = renderHook(() =>
      useLapsDataSubscription({
        eventId: "50",
        session: "4600101102",
        startingNo: "16",
        enabled: false,
      }),
    )
    expect(result.current.status).toBe("idle")
    expect(result.current.payload).toBeNull()
  })

  it("sends subscribe frame with session and startingNo, then ready on PID 7", async () => {
    const { result } = renderHook(() =>
      useLapsDataSubscription({
        eventId: "50",
        session: "4600101102",
        startingNo: "16",
        enabled: true,
      }),
    )

    const ws = await flushOpen()
    expect(result.current.status).toBe("connecting")

    const open = JSON.parse(ws.sent[0]!) as Record<string, unknown>
    expect(open.eventId).toBe("50")
    expect(open.eventPid).toEqual([7])
    expect(open.session).toBe("4600101102")
    expect(open.startingNo).toBe("16")

    ws.emitMessage(
      JSON.stringify({
        PID: "LTS_TIMESYNC",
        clientLocalTime: 1,
        serverLocalTime: 2,
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe("loading")
    })

    const pid7 = {
      PID: "7",
      SESSION: "4600101102",
      DATA: [{ L: "1", T: "8:12.345" }],
    }
    ws.emitMessage(JSON.stringify(pid7))

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
      expect(result.current.payload).toEqual(pid7)
    })
  })

  it("sets error on LTS_NOT_FOUND", async () => {
    const { result } = renderHook(() =>
      useLapsDataSubscription({
        eventId: "missing",
        session: "4600101102",
        startingNo: "16",
        enabled: true,
      }),
    )

    const ws = await flushOpen()
    ws.emitMessage(JSON.stringify({ PID: "LTS_NOT_FOUND" }))

    await waitFor(() => {
      expect(result.current.status).toBe("error")
      expect(result.current.error).toBe("event not found")
    })
  })
})
