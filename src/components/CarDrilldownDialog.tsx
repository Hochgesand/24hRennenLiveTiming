import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { getLapsData } from "@/lib/api"
import type { AverageMode } from "@/lib/lapTimes"
import { averageModeLabel, lapSeriesFromPayload } from "@/lib/lapTimes"
import type { RawResultRow } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

import { LapTimeChart } from "./LapTimeChart"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function findRowByStnr(
  rows: RawResultRow[] | undefined,
  stnr: string
): RawResultRow | undefined {
  if (!rows?.length) {
    return undefined
  }
  return rows.find((r) => str(r.STNR) === stnr)
}

const AVG_MODES: AverageMode[] = ["stint", "off", "last5", "last10", "last15"]

export function CarDrilldownDialog() {
  const { eventId: eventIdFromUrl } = useUrlConfig()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const session = sessionMeta?.SESSION
    ? String(sessionMeta.SESSION).trim()
    : null

  const selectedStartingNo = useUiStore((s) => s.selectedStartingNo)
  const closeDrilldown = useUiStore((s) => s.closeDrilldown)
  const results = sessionMeta?.RESULT

  const [averageMode, setAverageMode] = useState<AverageMode>("stint")

  const open = selectedStartingNo !== null
  const row = findRowByStnr(results, selectedStartingNo ?? "")
  const name = str(row?.NAME) || "Driver"
  const stnrLabel = selectedStartingNo ?? ""
  const eventId = str(sessionMeta?.EXPORTID) || eventIdFromUrl || null

  const canFetch = Boolean(open && eventId && session && stnrLabel)

  const lapsQuery = useQuery({
    queryKey: ["lapsData", eventId, session, stnrLabel],
    queryFn: () => getLapsData(eventId!, session!, stnrLabel),
    enabled: canFetch,
    staleTime: 60_000,
  })

  const series =
    canFetch && lapsQuery.isSuccess ? lapSeriesFromPayload(lapsQuery.data) : undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeDrilldown()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {name} #{stnrLabel}
          </DialogTitle>
          <DialogDescription>
            Lap times from session {session ?? "—"}
            {eventId ? ` · event ${eventId}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!eventId ? (
          <p className="text-muted-foreground text-sm" role="status">
            Event id not available yet (live session{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">EXPORTID</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">?event=…</code> in the
            URL).
          </p>
        ) : null}

        {eventId && !session ? (
          <p className="text-muted-foreground text-sm" role="status">
            Waiting for session id from live data…
          </p>
        ) : null}

        {canFetch && lapsQuery.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            Loading lap data…
          </p>
        ) : null}

        {canFetch && lapsQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {lapsQuery.error instanceof Error ? lapsQuery.error.message : "Failed to load laps"}
          </p>
        ) : null}

        {canFetch && lapsQuery.isSuccess && series === null ? (
          <p className="text-muted-foreground text-sm" role="status">
            Could not parse lap data.
          </p>
        ) : null}

        {canFetch &&
        lapsQuery.isSuccess &&
        series !== undefined &&
        series !== null &&
        series.length === 0 ? (
          <p className="text-muted-foreground text-sm" role="status">
            No lap rows with parseable times in this session.
          </p>
        ) : null}

        {series !== undefined && series !== null && series.length > 0 ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Reference average</span>
              <select
                className="border-input bg-background rounded-md border px-2 py-1.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={averageMode}
                onChange={(e) => setAverageMode(e.target.value as AverageMode)}
              >
                {AVG_MODES.map((m) => (
                  <option key={m} value={m}>
                    {averageModeLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <LapTimeChart points={series} averageMode={averageMode} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
