import {
  type LiveTimingJsonObject,
  type LtsTimesyncFrame,
  isJsonObject,
  isLtsNotFoundFrame,
  isLtsTimesyncFrame,
} from "@/lib/types"

/** Public WSS URL (direct to Azure). Used in production and in tests. */
export const LIVETIMING_WS_URL = "wss://livetiming.azurewebsites.net/"

const LIVETIMING_PROXY_PATH = "/api/livetiming/"

function defaultLiveTimingWsUrl(): string {
  const fromEnv = import.meta.env.VITE_LIVETIMING_WS_URL as string | undefined
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  const optInProd = import.meta.env.VITE_USE_LIVETIMING_PROXY === "1"
  const optOut = import.meta.env.VITE_USE_LIVETIMING_PROXY === "0"
  const useProxy =
    !optOut &&
    import.meta.env.MODE !== "test" &&
    (optInProd || import.meta.env.DEV) &&
    typeof window !== "undefined"
  if (useProxy) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws"
    return `${proto}://${window.location.host}${LIVETIMING_PROXY_PATH}`
  }
  return LIVETIMING_WS_URL
}

export type LiveTimingHandlers = {
  onTimesync?: (msg: LtsTimesyncFrame) => void
  onJson?: (msg: LiveTimingJsonObject) => void
  onError?: (message: string) => void
  onClose?: (ev: CloseEvent) => void
}

export type LiveTimingClientOptions = {
  url?: string
  eventId: string
  eventPid: number[]
  /** Extra fields merged into the open-subscribe frame (e.g. session, startingNo for PID 7). */
  subscribeExtras?: Record<string, string | number>
  /** Inject for tests (default: global WebSocket). */
  WebSocketImpl?: typeof WebSocket
}

/**
 * WebSocket client for livetiming.azurewebsites.net.
 * On open, sends `{ eventId, eventPid, clientLocalTime, ...subscribeExtras }`.
 * Expects `LTS_TIMESYNC` before any data frames (matches server contract).
 */
export class LiveTimingClient {
  private ws: WebSocket | null = null
  private sawTimesync = false
  private readonly url: string
  private readonly eventId: string
  private readonly eventPid: number[]
  private readonly subscribeExtras: Record<string, string | number> | undefined
  private readonly WebSocketImpl: typeof WebSocket

  constructor(options: LiveTimingClientOptions) {
    this.url = options.url ?? defaultLiveTimingWsUrl()
    this.eventId = options.eventId
    this.eventPid = options.eventPid
    this.subscribeExtras = options.subscribeExtras
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket
  }

  connect(handlers: LiveTimingHandlers = {}): void {
    const existing = this.ws
    if (existing) {
      existing.onopen = null
      existing.onmessage = null
      existing.onerror = null
      existing.onclose = null
      const rs = existing.readyState
      if (rs === 0 || rs === 1) {
        existing.close()
      }
    }
    this.ws = null
    this.sawTimesync = false

    let ws: InstanceType<typeof this.WebSocketImpl>
    try {
      ws = new this.WebSocketImpl(this.url)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "websocket constructor failed"
      handlers.onError?.(message)
      return
    }
    this.ws = ws

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          eventId: this.eventId,
          eventPid: this.eventPid,
          clientLocalTime: Date.now(),
          ...this.subscribeExtras,
        })
      )
    }

    ws.onmessage = (event) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(event.data))
      } catch {
        handlers.onError?.("invalid json frame")
        return
      }

      if (!isJsonObject(parsed)) {
        handlers.onError?.("invalid json frame")
        return
      }

      if (isLtsTimesyncFrame(parsed)) {
        this.sawTimesync = true
        handlers.onTimesync?.(parsed)
        return
      }

      if (isLtsNotFoundFrame(parsed)) {
        handlers.onError?.("event not found")
        return
      }

      if (!this.sawTimesync) {
        handlers.onError?.("expected LTS_TIMESYNC before data")
        ws.close()
        return
      }

      if (typeof parsed.PID !== "string") {
        handlers.onError?.("invalid json frame")
        return
      }

      handlers.onJson?.(parsed as LiveTimingJsonObject)
    }

    ws.onerror = () => {
      handlers.onError?.("websocket error")
    }

    ws.onclose = (ev) => {
      handlers.onClose?.(ev)
      this.ws = null
    }
  }

  close(): void {
    const ws = this.ws
    if (ws && ws.readyState === 1) {
      ws.close()
    }
    this.ws = null
    this.sawTimesync = false
  }
}
