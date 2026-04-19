import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "@/App.tsx"
import { RootErrorBoundary } from "@/components/RootErrorBoundary"
import { Toaster } from "@/components/ui/sonner"
import "@/index.css"

const ERUDA_STORAGE_KEY = "eruda"

async function maybeBootEruda(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get("debug") === "0") {
      localStorage.removeItem(ERUDA_STORAGE_KEY)
      return
    }
    const enabled =
      params.get("debug") === "1" || localStorage.getItem(ERUDA_STORAGE_KEY) === "1"
    if (!enabled) return
    if (params.get("debug") === "1") {
      localStorage.setItem(ERUDA_STORAGE_KEY, "1")
    }
    const erudaUrl = "https://cdn.jsdelivr.net/npm/eruda@3/+esm"
    const mod = (await import(
      /* @vite-ignore */ erudaUrl
    )) as {
      default?: { init: () => void }
      init?: () => void
    }
    const eruda = mod.default ?? mod
    if (typeof eruda?.init === "function") {
      eruda.init()
    }
  } catch (e) {
    console.warn("[eruda] failed to load", e)
  }
}

function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (e) => {
    console.error("[global error]", e.message, e.error?.stack ?? e)
  })
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason
    console.error(
      "[unhandled rejection]",
      reason && typeof reason === "object" && "stack" in reason
        ? (reason as Error).stack
        : reason,
    )
  })
}

const queryClient = new QueryClient()

async function boot(): Promise<void> {
  await maybeBootEruda()
  installGlobalErrorHandlers()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
