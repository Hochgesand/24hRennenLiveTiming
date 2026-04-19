import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { Locale } from "@/i18n/strings"
import { translate } from "@/i18n/strings"

type Ctx = {
  locale: Locale
  t: (key: string) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: (key: string) => translate(locale, key),
    }),
    [locale]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: "de",
      t: (key) => translate("de", key),
    }
  }
  return ctx
}
