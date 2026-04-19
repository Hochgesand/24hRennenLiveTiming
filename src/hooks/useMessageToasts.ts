import { useEffect, useRef } from "react"
import { toast } from "sonner"

import type { RaceMessage } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"

function messageKey(m: RaceMessage, fallbackIndex: number): string {
  if (m.ID !== undefined && m.ID !== null && m.ID !== "") {
    return `id:${String(m.ID)}`
  }
  const time = m.MESSAGETIME ?? ""
  const text = m.MESSAGE ?? ""
  return `tm:${String(time)}|${text}|${fallbackIndex}`
}

/**
 * Subscribes to incoming PID 3 race-control messages and surfaces any newly
 * received entries as toast notifications.
 *
 * - The first frame after connect/reconnect or event switch is treated as a
 *   historic snapshot and is NOT toasted; it only seeds the de-dup set.
 * - Subsequent frames toast any message whose key has not been seen before.
 * - When the messages frame is reset to `null` (event switch / disconnect),
 *   the de-dup state is cleared so the next snapshot is again silent.
 */
export function useMessageToasts(): void {
  const messagesFrame = useLiveStore((s) => s.messages)
  const seenKeysRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  useEffect(() => {
    if (messagesFrame === null) {
      seenKeysRef.current = new Set()
      initializedRef.current = false
      return
    }

    const messages = messagesFrame.MESSAGES ?? []

    if (!initializedRef.current) {
      initializedRef.current = true
      messages.forEach((m, i) => {
        seenKeysRef.current.add(messageKey(m, i))
      })
      return
    }

    messages.forEach((m, i) => {
      const key = messageKey(m, i)
      if (seenKeysRef.current.has(key)) {
        return
      }
      seenKeysRef.current.add(key)
      const text = (m.MESSAGE ?? "").trim()
      if (!text) {
        return
      }
      const group = (m.MESSAGEGROUP ?? "").trim()
      toast(text, {
        id: key,
        description: group || undefined,
      })
    })
  }, [messagesFrame])
}
