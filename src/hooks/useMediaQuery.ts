import * as React from "react"

import { subscribeMediaQueryChange } from "@/lib/mediaQuerySubscribe"

export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      return subscribeMediaQueryChange(mq, onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
