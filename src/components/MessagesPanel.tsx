import { useLayoutEffect, useMemo, useRef } from "react"

import type { RaceMessage } from "@/domain"
import { cn } from "@/lib/utils"
import { useLiveStore } from "@/store/useLiveStore"

function messageOrderKey(m: RaceMessage): number {
  const t = m.MESSAGETIME
  if (typeof t === "number" && !Number.isNaN(t)) {
    return t
  }
  if (typeof t === "string") {
    const parts = t.split(":").map((p) => Number.parseFloat(p))
    if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
      const h = parts[0] ?? 0
      const min = parts[1] ?? 0
      const s = parts[2] ?? 0
      return h * 3600 + min * 60 + s
    }
    return 0
  }
  const id = m.ID
  if (typeof id === "number" && !Number.isNaN(id)) {
    return id
  }
  if (typeof id === "string") {
    const n = Number(id)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function formatMessageTime(t: string | number | undefined): string {
  if (t === undefined || t === null) {
    return "—"
  }
  if (typeof t === "string") {
    const s = t.trim()
    return s || "—"
  }
  if (typeof t === "number" && !Number.isNaN(t)) {
    const ms = t > 1e11 ? t : t * 1000
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    }
  }
  return String(t)
}

export function MessagesPanel() {
  const messagesFrame = useLiveStore((s) => s.messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => {
    const raw = messagesFrame?.MESSAGES ?? []
    return [...raw].sort((a, b) => messageOrderKey(a) - messageOrderKey(b))
  }, [messagesFrame])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    el.scrollTop = el.scrollHeight
  }, [sorted])

  const empty = sorted.length === 0

  return (
    <section
      aria-label="Live race messages"
      className="flex h-full min-h-0 flex-1 flex-col rounded-xl border"
    >
      <h2 className="text-muted-foreground border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide">
        Messages
      </h2>
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          "max-h-[40vh] lg:max-h-none",
        )}
      >
        {empty ? (
          <p
            className="text-muted-foreground px-4 py-8 text-center text-sm"
            role="status"
          >
            No messages yet
          </p>
        ) : (
          <ul className="divide-border divide-y px-1 py-1">
            {sorted.map((m, i) => {
              const key =
                m.ID !== undefined && m.ID !== null
                  ? `msg-${String(m.ID)}`
                  : `msg-${i}-${formatMessageTime(m.MESSAGETIME)}`
              return (
                <li key={key} className="flex gap-2 px-2 py-2 text-sm">
                  <time
                    className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
                    dateTime={String(m.MESSAGETIME ?? "")}
                  >
                    {formatMessageTime(m.MESSAGETIME)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.MESSAGEGROUP ? (
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                          {m.MESSAGEGROUP}
                        </span>
                      ) : null}
                      <p className="min-w-0 break-words">{m.MESSAGE ?? "—"}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
