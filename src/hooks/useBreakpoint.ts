import { useSyncExternalStore } from "react"

export type Breakpoint = "mobile" | "tablet" | "desktop"

const MOBILE_MAX = 767
const TABLET_MAX = 1279

function breakpointFromWidth(width: number): Breakpoint {
  if (width <= MOBILE_MAX) {
    return "mobile"
  }
  if (width <= TABLET_MAX) {
    return "tablet"
  }
  return "desktop"
}

function subscribe(onStoreChange: () => void): () => void {
  const mqMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`)
  const mqTablet = window.matchMedia(
    `(min-width: ${MOBILE_MAX + 1}px) and (max-width: ${TABLET_MAX}px)`
  )
  const mqDesktop = window.matchMedia(`(min-width: ${TABLET_MAX + 1}px)`)
  const handler = () => onStoreChange()
  mqMobile.addEventListener("change", handler)
  mqTablet.addEventListener("change", handler)
  mqDesktop.addEventListener("change", handler)
  return () => {
    mqMobile.removeEventListener("change", handler)
    mqTablet.removeEventListener("change", handler)
    mqDesktop.removeEventListener("change", handler)
  }
}

function getWidth(): number {
  return window.innerWidth
}

function getServerSnapshot(): Breakpoint {
  return "desktop"
}

/**
 * Tailwind-aligned breakpoints: mobile ≤767, tablet 768–1279, desktop ≥1280.
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(
    subscribe,
    () => breakpointFromWidth(getWidth()),
    getServerSnapshot
  )
}
