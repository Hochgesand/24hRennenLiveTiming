import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useBreakpoint } from "@/hooks/useBreakpoint"

const TOAST_DURATION_MS = 5000

const Toaster = ({ ...props }: ToasterProps) => {
  const bp = useBreakpoint()
  const position: ToasterProps["position"] =
    bp === "mobile" ? "top-center" : "bottom-right"

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position={position}
      duration={TOAST_DURATION_MS}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
