import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { RawResultRow } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import { cn } from "@/lib/utils"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

/** Driver names: explicit wire keys, else split NAME by / or comma. */
function driverRoster(row: RawResultRow): string[] {
  const keys = ["DRIVER", "DRIVER1", "DRIVER2", "DRIVER3", "DRIVER4", "DRIVERS"] as const
  const fromKeys: string[] = []
  for (const k of keys) {
    const v = row[k as keyof RawResultRow]
    const s = str(v)
    if (s) {
      fromKeys.push(s)
    }
  }
  if (fromKeys.length > 0) {
    return fromKeys
  }
  const name = str(row.NAME)
  if (name.includes("/")) {
    return name
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (name.includes(",")) {
    return name
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return name ? [name] : []
}

function manufacturerMark(car: string): string {
  if (!car) {
    return "?"
  }
  const word = car.split(/\s+/)[0] ?? car
  return word.slice(0, 3).toUpperCase()
}

type DrilldownHeaderProps = {
  row: RawResultRow | null | undefined
  name: string
  startingNo: string
  session: string | null
  eventId: string | null
}

export function DrilldownHeader({
  row,
  name,
  startingNo,
  session,
  eventId,
}: DrilldownHeaderProps) {
  const { t } = useI18n()
  const team = str(row?.TEAM)
  const car = str(row?.CAR)
  const cls = str(row?.CLASSNAME)
  const roster = row ? driverRoster(row) : []

  return (
    <DialogHeader className="gap-3 sm:text-left">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold"
          title={car || "Car"}
          aria-hidden
        >
          {manufacturerMark(car)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl leading-tight">
              #{startingNo}
              {name ? ` · ${name}` : null}
            </DialogTitle>
            {cls ? (
              <span
                className={cn(
                  "border-primary/40 bg-primary/12 text-primary inline-flex rounded px-2 py-0.5 text-xs font-semibold",
                )}
              >
                {cls}
              </span>
            ) : null}
          </div>
          {team ? (
            <p className="text-muted-foreground text-sm font-medium">{team}</p>
          ) : null}
          {car ? (
            <p className="text-muted-foreground font-mono text-xs">{car}</p>
          ) : null}
          {roster.length > 0 ? (
            <p className="text-muted-foreground text-xs leading-snug">
              <span className="font-medium text-foreground/90">{t("drilldown.driversLabel")}: </span>
              {roster.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <DialogDescription>
        {session ? `Session ${session}` : "Session —"}
        {eventId ? ` · Event ${eventId}` : ""}
      </DialogDescription>
    </DialogHeader>
  )
}
