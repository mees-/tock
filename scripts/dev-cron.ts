import type { Plugin } from "vite"

const MINUTE_MS = 60_000

// The Cloudflare Vite plugin doesn't fire Cron Triggers, so trigger the
// scheduled handler every minute while the dev server runs.
export function devCron(): Plugin {
  return {
    name: "dev-cron",
    apply: "serve",
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined

      async function trigger(minuteStart: number) {
        const baseUrl = server.resolvedUrls?.local[0]
        if (baseUrl == null) return
        const url = new URL("/cdn-cgi/local/scheduled", baseUrl)
        url.searchParams.set("cron", "* * * * *")
        url.searchParams.set("time", String(minuteStart))
        try {
          const res = await fetch(url)
          if (!res.ok) {
            server.config.logger.error(
              `Scheduled trigger failed: ${res.status}`,
            )
          }
        } catch (err) {
          server.config.logger.error(`Scheduled trigger failed: ${err}`)
        }
      }

      function scheduleNext() {
        const nextMinute = Math.ceil((Date.now() + 1) / MINUTE_MS) * MINUTE_MS
        timer = setTimeout(() => {
          scheduleNext()
          void trigger(nextMinute)
        }, nextMinute - Date.now())
      }

      server.httpServer?.once("listening", scheduleNext)
      server.httpServer?.once("close", () => clearTimeout(timer))
    },
  }
}
