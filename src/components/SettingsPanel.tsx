import { ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/i18n/I18nContext"
import { useUrlConfig } from "@/hooks/useUrlConfig"
import { setUrlLang } from "@/hooks/useUrlNavigation"
import type { UiLang } from "@/hooks/useUrlConfig"
import {
  ALL_LEADERBOARD_COLUMN_DEFS,
  sectorColumnKey,
} from "@/lib/leaderboardColumns"
import { computeMaxSectors, sortLeaderboardRows } from "@/lib/leaderboard"
import { replaceSearchParams } from "@/lib/patchSearchParams"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"
import { cn } from "@/lib/utils"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function labelForKey(key: string): string {
  return key === "" ? "—" : key
}

export function SettingsPanel() {
  const { t, locale } = useI18n()
  const { eventId } = useUrlConfig()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)

  const excludedClasses = useFilterStore((s) => s.excludedClasses)
  const excludedProams = useFilterStore((s) => s.excludedProams)
  const excludedColumns = useFilterStore((s) => s.excludedColumns)
  const toggleExcludedClass = useFilterStore((s) => s.toggleExcludedClass)
  const toggleExcludedProam = useFilterStore((s) => s.toggleExcludedProam)
  const toggleExcludedColumn = useFilterStore((s) => s.toggleExcludedColumn)
  const clearExcludedClasses = useFilterStore((s) => s.clearExcludedClasses)
  const clearExcludedProams = useFilterStore((s) => s.clearExcludedProams)
  const clearExcludedColumns = useFilterStore((s) => s.clearExcludedColumns)

  const results = sessionMeta?.RESULT ?? []
  const sorted = useMemo(() => sortLeaderboardRows(results), [results])
  const maxSectors = useMemo(() => computeMaxSectors(sorted), [sorted])

  const classNames = useMemo(
    () => uniqueSorted(sorted.map((r) => str(r.CLASSNAME))),
    [sorted]
  )
  const proKeys = useMemo(() => uniqueSorted(sorted.map((r) => str(r.PRO))), [sorted])

  const [eventDraft, setEventDraft] = useState(eventId ?? "")
  useEffect(() => {
    setEventDraft(eventId ?? "")
  }, [eventId])

  const applyEventId = () => {
    const v = eventDraft.trim()
    replaceSearchParams((p) => {
      if (v.length > 0) {
        p.set("event", v)
      } else {
        p.delete("event")
      }
    })
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      /* ignore */
    }
  }

  const setLang = (next: UiLang) => {
    setUrlLang(next)
  }

  const sectorDefs = useMemo(() => {
    if (maxSectors <= 0) {
      return []
    }
    return Array.from({ length: maxSectors }, (_, i) => {
      const n = i + 1
      return { key: sectorColumnKey(n), label: `S${n}` }
    })
  }, [maxSectors])

  const showClassFilter = classNames.length > 0
  const showProFilter = proKeys.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t("settings.language")}
        </label>
        <div className="flex gap-2">
          {(["de", "en"] as const).map((lang) => (
            <Button
              key={lang}
              type="button"
              size="sm"
              variant={locale === lang ? "default" : "outline"}
              className={cn(locale === lang && "pointer-events-none")}
              onClick={() => setLang(lang)}
            >
              {lang.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide" htmlFor="settings-event">
          {t("settings.eventId")}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="settings-event"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 min-w-[12rem] flex-1 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            value={eventDraft}
            onChange={(e) => setEventDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyEventId()
              }
            }}
            inputMode="numeric"
            autoComplete="off"
          />
          <Button type="button" variant="secondary" size="sm" onClick={applyEventId}>
            OK
          </Button>
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={copyShareUrl}>
        {t("settings.share")}
      </Button>

      <div className="border-border border-t pt-4">
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
          {t("filters.classes")} / {t("filters.proam")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {showClassFilter ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {t("filters.classes")}
                  {excludedClasses.size > 0 ? (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs tabular-nums">
                      {excludedClasses.size}
                    </span>
                  ) : null}
                  <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{t("filters.classes")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {classNames.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={`class-${c}`}
                    checked={!excludedClasses.has(c)}
                    onCheckedChange={(checked) => {
                      const wantExcluded = !checked
                      if (wantExcluded !== excludedClasses.has(c)) {
                        toggleExcludedClass(c)
                      }
                    }}
                  >
                    {labelForKey(c)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearExcludedClasses}>{t("filters.all")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {showProFilter ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {t("filters.proam")}
                  {excludedProams.size > 0 ? (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs tabular-nums">
                      {excludedProams.size}
                    </span>
                  ) : null}
                  <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{t("filters.proam")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {proKeys.map((p) => (
                  <DropdownMenuCheckboxItem
                    key={`pro-${p}`}
                    checked={!excludedProams.has(p)}
                    onCheckedChange={(checked) => {
                      const wantExcluded = !checked
                      if (wantExcluded !== excludedProams.has(p)) {
                        toggleExcludedProam(p)
                      }
                    }}
                  >
                    {labelForKey(p)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearExcludedProams}>{t("filters.all")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
          {t("filters.columns")}
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          {ALL_LEADERBOARD_COLUMN_DEFS.map(({ key, labelKey }) => (
            <label
              key={key}
              className="border-border bg-card/50 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={!excludedColumns.has(key)}
                onChange={() => toggleExcludedColumn(key)}
              />
              <span className="truncate">{t(labelKey)}</span>
            </label>
          ))}
          {sectorDefs.map(({ key, label }) => (
            <label
              key={key}
              className="border-border bg-card/50 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={!excludedColumns.has(key)}
                onChange={() => toggleExcludedColumn(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground mt-3"
          onClick={clearExcludedColumns}
        >
          {t("filters.all")} ({t("filters.columns")})
        </Button>
      </div>
    </div>
  )
}
