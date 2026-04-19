import { cn } from "@/lib/utils"
import { formatDataNumeric, type NumericKind } from "@/lib/formatNumeric"

export type DataNumericProps = {
  value: unknown
  kind?: NumericKind
  className?: string
}

/**
 * Tabular monospace numeric cell. Use for lap times, gaps, sectors, deltas.
 */
export function DataNumeric({ value, kind = "lapTime", className }: DataNumericProps) {
  const { text, deltaSign } = formatDataNumeric(value, kind)
  return (
    <span
      className={cn(
        "inline-block min-w-[4.25rem] text-right font-mono text-sm tabular-nums",
        deltaSign === "pos" && "text-[var(--delta-worse)]",
        deltaSign === "neg" && "text-[var(--delta-better)]",
        deltaSign === "zero" && "text-muted-foreground",
        className
      )}
    >
      {text}
    </span>
  )
}
