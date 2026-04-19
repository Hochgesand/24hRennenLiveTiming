import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LiveTimingClient, LIVETIMING_WS_URL } from "./ws"

/** Minimal fake WebSocket for unit tests (defer open so `onopen` is wired). */
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

async function flushOpen(): Promise<MockWebSocket> {
  await Promise.resolve()
  const ws = lastMockInstance
  if (!ws) throw new Error("expected MockWebSocket instance")
  return ws
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

describe("LiveTimingClient (mock WebSocket)", () => {
  beforeEach(() => {
    lastMockInstance = null
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("sends valid open-frame JSON with eventId, eventPid, clientLocalTime", async () => {
    const MockCtor = createMockCtor()
    const client = new LiveTimingClient({
      WebSocketImpl: MockCtor,
      eventId: "evt-42",
      eventPid: [0, 3, 4, 501],
    })
    client.connect()

    const ws = await flushOpen()
    expect(ws.url).toBe(LIVETIMING_WS_URL)
    expect(ws.sent).toHaveLength(1)

    const open = JSON.parse(ws.sent[0]!) as {
      eventId: string
      eventPid: number[]
      clientLocalTime: number
    }
    expect(open).toEqual({
      eventId: "evt-42",
      eventPid: [0, 3, 4, 501],
      clientLocalTime: Date.now(),
    })
  })

  it("merges subscribeExtras into the open frame (session, startingNo)", async () => {
    const MockCtor = createMockCtor()
    const client = new LiveTimingClient({
      WebSocketImpl: MockCtor,
      eventId: "50",
      eventPid: [7],
      subscribeExtras: { session: "4600101102", startingNo: "16" },
    })
    client.connect()

    const ws = await flushOpen()
    const open = JSON.parse(ws.sent[0]!) as Record<string, unknown>
    expect(open.eventId).toBe("50")
    expect(open.eventPid).toEqual([7])
    expect(open.clientLocalTime).toBe(Date.now())
    expect(open.session).toBe("4600101102")
    expect(open.startingNo).toBe("16")
  })

  it("after LTS_TIMESYNC, delivers PID 0 frames via onJson", async () => {
    const MockCtor = createMockCtor()
    const onTimesync = vi.fn()
    const onJson = vi.fn()

    const client = new LiveTimingClient({
      WebSocketImpl: MockCtor,
      eventId: "e1",
      eventPid: [0],
    })
    client.connect({ onTimesync, onJson })

    const ws = await flushOpen()

    ws.emitMessage(
      JSON.stringify({
        PID: "LTS_TIMESYNC",
        clientLocalTime: 1,
        serverLocalTime: 2,
      })
    )
    expect(onTimesync).toHaveBeenCalledTimes(1)

    const pid0 = { PID: "0", RESULT: [], SESSION: "Q" }
    ws.emitMessage(JSON.stringify(pid0))
    expect(onJson).toHaveBeenCalledTimes(1)
    expect(onJson).toHaveBeenCalledWith(pid0)
  })

  it("calls onError when WebSocket constructor throws", () => {
    const ThrowingCtor = class {
      constructor(url: string | URL) {
        void url
        throw new Error("blocked")
      }
    } as unknown as typeof WebSocket

    const onError = vi.fn()
    const client = new LiveTimingClient({
      WebSocketImpl: ThrowingCtor,
      eventId: "e1",
      eventPid: [0],
    })
    client.connect({ onError })

    expect(onError).toHaveBeenCalledWith("blocked")
  })

  it("calls onError with event not found for LTS_NOT_FOUND", async () => {
    const MockCtor = createMockCtor()
    const onError = vi.fn()

    const client = new LiveTimingClient({
      WebSocketImpl: MockCtor,
      eventId: "missing",
      eventPid: [0],
    })
    client.connect({ onError })

    const ws = await flushOpen()
    ws.emitMessage(JSON.stringify({ PID: "LTS_NOT_FOUND" }))

    expect(onError).toHaveBeenCalledWith("event not found")
  })
})
