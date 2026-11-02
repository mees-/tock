import { and, eq, inArray, lt, or } from "drizzle-orm"
import { getDb } from "./db/client"
import { jobRuns } from "./db/schema"
import { env } from "./env"
import { logger } from "./logger"

const DAY_MS = 86_400_000
const SUCCESSFUL_RUN_RETENTION_DAYS = 30
const FAILED_RUN_RETENTION_DAYS = 90
const PRUNE_AT_MINUTE = 0
// Caps one pass so a backlog can't exceed D1's per-query time limit.
const PRUNE_BATCH_SIZE = 5_000

async function pruneExpiredJobRuns(now: Date) {
  const successfulCutoff = new Date(
    now.getTime() - SUCCESSFUL_RUN_RETENTION_DAYS * DAY_MS,
  )
  const failedCutoff = new Date(
    now.getTime() - FAILED_RUN_RETENTION_DAYS * DAY_MS,
  )
  const db = getDb()
  const expired = db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      or(
        and(
          eq(jobRuns.status, "success"),
          lt(jobRuns.triggeredAt, successfulCutoff),
        ),
        and(
          inArray(jobRuns.status, ["failure", "timeout"]),
          lt(jobRuns.triggeredAt, failedCutoff),
        ),
      ),
    )
    .limit(PRUNE_BATCH_SIZE)
  const result = await db.delete(jobRuns).where(inArray(jobRuns.id, expired))
  logger.info("Pruned expired job runs", { deleted: result.meta.changes })
}

// Self-hosted (community edition) installs keep their full run history.
export async function pruneJobRunsHourly(scheduledTime: number) {
  if (env.COMMUNITY_EDITION) return
  const now = new Date(scheduledTime)
  if (now.getUTCMinutes() !== PRUNE_AT_MINUTE) return
  await pruneExpiredJobRuns(now)
}
