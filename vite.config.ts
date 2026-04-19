import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { configDefaults, defineConfig } from "vitest/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Upstream live timing (WSS). Dev client uses `/api/livetiming` → proxied here. */
const LIVETIMING_UPSTREAM = "https://livetiming.azurewebsites.net"

const livetimingProxy = {
  target: LIVETIMING_UPSTREAM,
  changeOrigin: true,
  ws: true,
  secure: true,
  rewrite: (p: string) => {
    const next = p.replace(/^\/api\/livetiming\/?/, "") || "/"
    return next.startsWith("/") ? next : `/${next}`
  },
} as const

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    proxy: {
      "/api/livetiming": livetimingProxy,
    },
  },
  preview: {
    proxy: {
      "/api/livetiming": livetimingProxy,
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "**/e2e/**"],
  },
})
