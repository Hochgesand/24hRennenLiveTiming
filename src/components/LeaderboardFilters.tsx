import { ChevronDown } from "lucide-react"
import { useMemo } from "react"

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
import { ALL_LEADERBOARD_COLUMN_DEFS, sectorColumnKey } from "@/lib/leaderboardColumns"
import type { RawResultRow } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import { useFilterStore } from "@/store/useFilterStore"
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

export function LeaderboardFilters({
  sourceRows,
  maxSectors,
}: {
  sourceRows: RawResultRow[]
  maxSectors: number
}) {
  const excludedClasses = useFilterStore((s) => s.excludedClasses)
  const excludedProams = useFilterStore((s) => s.excludedProams)
  const excludedColumns = useFilterStore((s) => s.excludedColumns)
  const toggleExcludedClass = useFilterStore((s) => s.toggleExcludedClass)
  const toggleExcludedProam = useFilterStore((s) => s.toggleExcludedProam)
  const toggleExcludedColumn = useFilterStore((s) => s.toggleExcludedColumn)
  const clearExcludedClasses = useFilterStore((s) => s.clearExcludedClasses)
  const clearExcludedProams = useFilterStore((s) => s.clearExcludedProams)
  const clearExcludedColumns = useFilterStore((s) => s.clearExcludedColumns)
  const { t } = useI18n()

  const classNames = useMemo(
    () => uniqueSorted(sourceRows.map((r) => str(r.CLASSNAME))),
    [sourceRows]
  )
  const proKeys = useMemo(() => uniqueSorted(sourceRows.map((r) => str(r.PRO))), [sourceRows])

  const anyFilter =
    excludedClasses.size > 0 || excludedProams.size > 0 || excludedColumns.size > 0

  const showClassFilter = classNames.length > 0
  const showProFilter = proKeys.length > 0

  const sectorColumnEntries = useMemo(() => {
    if (maxSectors <= 0) {
      return []
    }
    return Array.from({ length: maxSectors }, (_, i) => {
      const n = i + 1
      return { key: sectorColumnKey(n), label: `S${n}` }
    })
  }, [maxSectors])

  if (!showClassFilter && !showProFilter) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ColumnVisibilityMenu
          excludedColumns={excludedColumns}
          toggleExcludedColumn={toggleExcludedColumn}
          clearExcludedColumns={clearExcludedColumns}
          sectorColumnEntries={sectorColumnEntries}
          anyColumnHidden={excludedColumns.size > 0}
        />
      </div>
    )
  }

  return (
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
            <DropdownMenuItem onSelect={clearExcludedClasses}>{t("filters.allClasses")}</DropdownMenuItem>
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
            <DropdownMenuItem onSelect={clearExcludedProams}>{t("filters.allProam")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ColumnVisibilityMenu
        excludedColumns={excludedColumns}
        toggleExcludedColumn={toggleExcludedColumn}
        clearExcludedColumns={clearExcludedColumns}
        sectorColumnEntries={sectorColumnEntries}
        anyColumnHidden={excludedColumns.size > 0}
      />

      {anyFilter ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          type="button"
          onClick={() => {
            clearExcludedClasses()
            clearExcludedProams()
            clearExcludedColumns()
          }}
        >
          {t("filters.all")}
        </Button>
      ) : null}
    </div>
  )
}

function ColumnVisibilityMenu({
  excludedColumns,
  toggleExcludedColumn,
  clearExcludedColumns,
  sectorColumnEntries,
  anyColumnHidden,
}: {
  excludedColumns: Set<string>
  toggleExcludedColumn: (key: string) => void
  clearExcludedColumns: () => void
  sectorColumnEntries: { key: string; label: string }[]
  anyColumnHidden: boolean
}) {
  const { t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {t("filters.columns")}
          {anyColumnHidden ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs tabular-nums">
              {excludedColumns.size}
            </span>
          ) : null}
          <ChevronDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto">
        <DropdownMenuLabel>{t("filters.columns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_LEADERBOARD_COLUMN_DEFS.map(({ key, labelKey }) => (
          <DropdownMenuCheckboxItem
            key={`col-${key}`}
            checked={!excludedColumns.has(key)}
            onCheckedChange={(checked) => {
              const wantExcluded = !checked
              if (wantExcluded !== excludedColumns.has(key)) {
                toggleExcludedColumn(key)
              }
            }}
          >
            {t(labelKey)}
          </DropdownMenuCheckboxItem>
        ))}
        {sectorColumnEntries.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {sectorColumnEntries.map(({ key, label }) => (
              <DropdownMenuCheckboxItem
                key={`col-${key}`}
                checked={!excludedColumns.has(key)}
                onCheckedChange={(checked) => {
                  const wantExcluded = !checked
                  if (wantExcluded !== excludedColumns.has(key)) {
                    toggleExcludedColumn(key)
                  }
                }}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={clearExcludedColumns}>{t("filters.allColumns")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
