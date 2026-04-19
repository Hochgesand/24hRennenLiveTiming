import { useEffect, useRef, useState } from "react"

import { isPid7Frame, type Pid7Frame } from "@/domain"
import { LiveTimingClient, type LiveTimingHandlers } from "@/lib/ws"

const MAX_RECONNECT_ATTEMPTS = 3

export type LapsStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "loading"
  | "ready"
  | "error"

function isCleanDisconnect(code: number): boolean {
  return code === 1000 || code === 1001 || code === 1005
}

export function useLapsDataSubscription(args: {
  eventId: string | null
  session: string | null
  startingNo: string | null
  enabled: boolean
}): { status: LapsStatus; error: string | null; payload: Pid7Frame | null } {
  const { eventId, session, startingNo, enabled } = args

  const [status, setStatus] = useState<LapsStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<Pid7Frame | null>(null)

  const intentionalCloseRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientRef = useRef<LiveTimingClient | null>(null)

  useEffect(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const canRun =
      enabled &&
      eventId != null &&
      eventId !== "" &&
      session != null &&
      session !== "" &&
      startingNo != null &&
      startingNo !== ""

    if (!canRun) {
      intentionalCloseRef.current = true
      clientRef.current?.close()
      clientRef.current = null
      reconnectAttemptRef.current = 0
      queueMicrotask(() => {
        setStatus("idle")
        setError(null)
        setPayload(null)
      })
      return
    }

    intentionalCloseRef.current = false
    reconnectAttemptRef.current = 0
    queueMicrotask(() => {
      setError(null)
      setPayload(null)
      setStatus("connecting")
    })

    const client = new LiveTimingClient({
      eventId,
      eventPid: [7],
      subscribeExtras: { session, startingNo },
    })
    clientRef.current = client

    const scheduleReconnect = () => {
      const attempt = reconnectAttemptRef.current
      const delayMs = Math.min(30_000, 1000 * 2 ** (attempt - 1))
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (intentionalCloseRef.current) return
        setStatus("connecting")
        client.connect(buildHandlers())
      }, delayMs)
    }

    const buildHandlers = (): LiveTimingHandlers => ({
      onTimesync: () => {
        reconnectAttemptRef.current = 0
        setStatus("loading")
      },
      onJson: (msg) => {
        if (isPid7Frame(msg)) {
          setPayload(msg)
          setStatus("ready")
        }
      },
      onError: (message) => {
        if (message === "websocket error") {
          setStatus("connecting")
          return
        }
        setStatus("error")
        setError(message)
        intentionalCloseRef.current = true
        client.close()
      },
      onClose: (ev) => {
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false
          return
        }
        if (isCleanDisconnect(ev.code)) {
          setStatus("idle")
          return
        }
        reconnectAttemptRef.current += 1
        if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
          setStatus("error")
          setError("Max reconnect attempts")
          return
        }
        scheduleReconnect()
      },
    })

    client.connect(buildHandlers())

    return () => {
      intentionalCloseRef.current = true
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      client.close()
      clientRef.current = null
    }
  }, [enabled, eventId, session, startingNo])

  return { status, error, payload }
}
