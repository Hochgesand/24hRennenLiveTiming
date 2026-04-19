import { useEffect, useRef } from "react"

import { useUrlConfig } from "@/hooks/useUrlConfig"
import { computeRemoteTimeDiff } from "@/lib/timeSync"
import {
  isPid0Frame,
  isPid3Frame,
  isPid4Frame,
  isPid501Frame,
  isPid9002Frame,
} from "@/domain"
import { LiveTimingClient, type LiveTimingHandlers } from "@/lib/ws"
import { useLiveStore } from "@/store/useLiveStore"

const MAX_RECONNECT_ATTEMPTS = 10

function isCleanDisconnect(code: number): boolean {
  return code === 1000 || code === 1001 || code === 1005
}

export function useLiveConnection(): { missingEvent: boolean } {
  const { eventId } = useUrlConfig()
  const setConnection = useLiveStore((s) => s.setConnection)
  const setSessionMeta = useLiveStore((s) => s.setSessionMeta)
  const setTrack = useLiveStore((s) => s.setTrack)
  const setMessages = useLiveStore((s) => s.setMessages)
  const setTopQualifying = useLiveStore((s) => s.setTopQualifying)
  const setStatistics = useLiveStore((s) => s.setStatistics)
  const setRemoteTimeDiffMs = useLiveStore((s) => s.setRemoteTimeDiffMs)

  const intentionalCloseRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const missingEvent = !eventId

  useEffect(() => {
    if (!eventId) {
      setSessionMeta(null)
      setTrack(null)
      setMessages(null)
      setTopQualifying(null)
      setStatistics(null)
      setConnection({ status: "idle", error: null })
      return
    }

    intentionalCloseRef.current = false
    reconnectAttemptRef.current = 0
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    setSessionMeta(null)
    setTrack(null)
    setMessages(null)
    setTopQualifying(null)
    setStatistics(null)
    setConnection({ status: "connecting", error: null })

    const client = new LiveTimingClient({
      eventId,
      eventPid: [0, 3, 4, 501, 9002],
    })

    const scheduleReconnect = () => {
      const attempt = reconnectAttemptRef.current
      const delayMs = Math.min(30_000, 1000 * 2 ** (attempt - 1))
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (intentionalCloseRef.current) return
        setConnection({ status: "connecting", error: null })
        client.connect(buildHandlers())
      }, delayMs)
    }

    const buildHandlers = (): LiveTimingHandlers => ({
      onTimesync: (msg) => {
        reconnectAttemptRef.current = 0
        const now = Date.now()
        setRemoteTimeDiffMs(
          computeRemoteTimeDiff(now, msg.clientLocalTime, msg.serverLocalTime),
        )
        setConnection({ status: "connected", error: null })
      },
      onJson: (msg) => {
        if (isPid0Frame(msg)) {
          setSessionMeta(msg)
        } else if (isPid3Frame(msg)) {
          setMessages(msg)
        } else if (isPid4Frame(msg)) {
          setTrack(msg)
        } else if (isPid501Frame(msg)) {
          setTopQualifying(msg)
        } else if (isPid9002Frame(msg)) {
          setStatistics(msg)
        }
      },
      onError: (message) => {
        if (message === "websocket error") {
          setConnection({ status: "connecting", error: null })
          return
        }
        setConnection({ status: "error", error: message })
        intentionalCloseRef.current = true
        client.close()
      },
      onClose: (ev) => {
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false
          return
        }
        if (isCleanDisconnect(ev.code)) {
          setConnection({ status: "closed", error: null })
          return
        }
        reconnectAttemptRef.current += 1
        if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
          setConnection({ status: "error", error: "Max reconnect attempts" })
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
    }
  }, [
    eventId,
    setConnection,
    setMessages,
    setRemoteTimeDiffMs,
    setSessionMeta,
    setStatistics,
    setTopQualifying,
    setTrack,
  ])

  return { missingEvent }
}
