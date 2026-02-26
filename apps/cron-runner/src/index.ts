import { syncJobs } from "./scheduler"
import { logger } from "./logger"
import { env } from "./env"

async function main() {
  logger.info("Cron runner starting...")

  // Initial load
  await syncJobs()

  // Poll for changes — use recursive setTimeout to avoid concurrent invocations
  // if syncJobs takes longer than the interval.
  async function scheduledSync() {
    try {
      await syncJobs()
    } catch (err) {
      logger.error(err, "Sync failed")
    }
    setTimeout(scheduledSync, env.SYNC_INTERVAL_MS)
  }

  setTimeout(scheduledSync, env.SYNC_INTERVAL_MS)

  logger.info({ syncIntervalMs: env.SYNC_INTERVAL_MS }, "Cron runner started")
}

main().catch(err => {
  logger.error(err, "Cron runner failed to start")
  process.exit(1)
})
