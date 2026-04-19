import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import {
  DrilldownHeader,
  DriverStintTimeline,
  KpiStrip,
  LeaderDeltaChart,
  TelemetryPlaceholder,
} from "@/components/drilldown"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import type { RawResultRow } from "@/domain"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { getLapsData } from "@/lib/api"
import { extractLapsFromExport } from "@/lib/lapExport"
import { gapSeriesToLeader } from "@/lib/leaderDeltaSeries"
import type { AverageMode } from "@/lib/lapTimes"
import { averageModeLabel, lapSeriesFromPayload } from "@/lib/lapTimes"
import { cn } from "@/lib/utils"
import { deriveStintsFromLaps } from "@/lib/stintFromLaps"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

import { LapSectorMatrix } from "./LapSectorMatrix"
import { LapTimeChart } from "./LapTimeChart"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function findRowByStnr(
  rows: RawResultRow[] | undefined,
  stnr: string,
): RawResultRow | undefined {
  if (!rows?.length) {
    return undefined
  }
  return rows.find((r) => str(r.STNR) === stnr)
}

function positionSortKey(p: RawResultRow["POSITION"]): number {
  if (p === undefined || p === null) {
    return Infinity
  }
  const n = Number(String(p).trim())
  return Number.isFinite(n) ? n : Infinity
}

/** First row by `POSITION` — leader `STNR` for gap-to-leader lap data. */
function leaderStartingNo(results: RawResultRow[] | undefined): string | null {
  if (!results?.length) {
    return null
  }
  const sorted = [...results].sort(
    (a, b) => positionSortKey(a.POSITION) - positionSortKey(b.POSITION),
  )
  const st = sorted[0]?.STNR
  const s = st != null ? String(st).trim() : ""
  return s !== "" ? s : null
}

const AVG_MODES: AverageMode[] = ["stint", "off", "last5", "last10", "last15"]

export function CarDrilldownDialog() {
  const { eventId: eventIdFromUrl } = useUrlConfig()
  const breakpoint = useBreakpoint()
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

  const leaderStnr = useMemo(() => leaderStartingNo(results), [results])
  const fetchLeader =
    Boolean(open && eventId && session && leaderStnr && leaderStnr !== stnrLabel)

  const canFetch = Boolean(open && eventId && session && stnrLabel)

  const lapsQuery = useQuery({
    queryKey: ["lapsData", eventId, session, stnrLabel],
    queryFn: () => getLapsData(eventId!, session!, stnrLabel),
    enabled: canFetch,
    staleTime: 60_000,
  })

  const leaderLapsQuery = useQuery({
    queryKey: ["lapsData", eventId, session, "leader", leaderStnr],
    queryFn: () => getLapsData(eventId!, session!, leaderStnr!),
    enabled: fetchLeader,
    staleTime: 60_000,
  })

  const series =
    canFetch && lapsQuery.isSuccess ? lapSeriesFromPayload(lapsQuery.data) : undefined

  const leaderSeries =
    fetchLeader && leaderLapsQuery.isSuccess
      ? lapSeriesFromPayload(leaderLapsQuery.data)
      : null

  const rawLaps =
    canFetch && lapsQuery.isSuccess ? extractLapsFromExport(lapsQuery.data) : []

  const stints = useMemo(() => deriveStintsFromLaps(rawLaps), [rawLaps])

  const gapPoints = useMemo(() => {
    if (!series || series.length === 0) {
      return []
    }
    if (leaderStnr !== null && leaderStnr === stnrLabel) {
      return gapSeriesToLeader(series, series)
    }
    return gapSeriesToLeader(series, leaderSeries)
  }, [series, leaderSeries, leaderStnr, stnrLabel])

  const isDesktop = breakpoint === "desktop"
  const dialogContentClass = cn(
    !isDesktop &&
      "fixed right-0 bottom-0 left-0 top-auto max-h-[90vh] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-t-xl rounded-b-none sm:max-w-full",
    isDesktop && "sm:max-w-5xl",
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeDrilldown()
        }
      }}
    >
      <DialogContent className={dialogContentClass} showCloseButton>
        <DrilldownHeader
          name={name}
          startingNo={stnrLabel}
          session={session}
          eventId={eventId}
        />

        <KpiStrip row={row} series={series ?? null} />

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

        {fetchLeader && leaderLapsQuery.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            Loading leader lap data…
          </p>
        ) : null}

        {fetchLeader && leaderLapsQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {leaderLapsQuery.error instanceof Error
              ? leaderLapsQuery.error.message
              : "Failed to load leader laps"}
          </p>
        ) : null}

        {rawLaps.length > 0 ? <DriverStintTimeline stints={stints} /> : null}

        {series !== undefined && series !== null && series.length > 0 ? (
          <LeaderDeltaChart points={gapPoints} />
        ) : null}

        <TelemetryPlaceholder />

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

        {rawLaps.length > 0 ? <LapSectorMatrix laps={rawLaps} /> : null}
      </DialogContent>
    </Dialog>
  )
}
