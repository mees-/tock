import { getDb, jobs, jobRuns, users, isProAccessActive } from "database"
import type { DbJob, DbJobRunInsert, JobRunStatus } from "database"
import { asc, eq } from "drizzle-orm"
import { firesWithinMinute, MINUTE_MS } from "./cron"
import { env } from "./env"
import { logger } from "./logger"

const MAX_RESPONSE_BODY_LENGTH = 10_000
const REQUEST_TIMEOUT_MS = 30_000

async function getRunnableJobs() {
  const rows = await getDb()
    .select({
      job: jobs,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionStatusUpdatedAt: users.subscriptionStatusUpdatedAt,
    })
    .from(jobs)
    .innerJoin(users, eq(jobs.userId, users.id))
    .where(eq(jobs.isActive, true))
    .orderBy(asc(jobs.createdAt))

  // Users without active pro access may only run their single oldest active job
  const seenFreeUsers = new Set<number>()
  const runnable: DbJob[] = []
  for (const { job, subscriptionStatus, subscriptionStatusUpdatedAt } of rows) {
    const hasProAccess =
      env.COMMUNITY_EDITION ||
      isProAccessActive({ subscriptionStatus, subscriptionStatusUpdatedAt })
    if (hasProAccess) {
      runnable.push(job)
    } else if (!seenFreeUsers.has(job.userId)) {
      seenFreeUsers.add(job.userId)
      runnable.push(job)
    }
  }
  return runnable
}

// Stops reading once the limit is reached so large responses don't cost CPU or memory.
async function readTruncatedBody(response: Response) {
  if (response.body == null) return ""
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ""
  while (text.length <= MAX_RESPONSE_BODY_LENGTH) {
    const { done, value } = await reader.read()
    if (done) return text
    text += value
  }
  await reader.cancel()
  return text.slice(0, MAX_RESPONSE_BODY_LENGTH) + "\n[truncated]"
}

async function executeJob(job: DbJob): Promise<DbJobRunInsert> {
  const triggeredAt = new Date()
  const start = Date.now()

  try {
    const response = await fetch(job.endpoint, {
      method: job.method,
      headers: { "Content-Type": "application/json", ...job.headers },
      body: job.body ?? undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const durationMs = Date.now() - start
    const responseBody = await readTruncatedBody(response)

    logger.debug("Job executed", {
      jobId: job.id,
      url: job.endpoint,
      method: job.method,
      statusCode: response.status,
      durationMs,
    })

    return {
      jobId: job.id,
      triggeredAt,
      completedAt: new Date(),
      status: response.ok ? "success" : "failure",
      httpStatusCode: response.status,
      responseBody,
      responseHeaders: JSON.stringify(Object.fromEntries(response.headers)),
      durationMs,
    }
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError"
    const status: JobRunStatus = isTimeout ? "timeout" : "failure"
    logger.warn("Job failed", { jobId: job.id, err, isTimeout })

    return {
      jobId: job.id,
      triggeredAt,
      completedAt: new Date(),
      status,
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

function isForeignKeyError(err: unknown) {
  return err instanceof Error && err.message.includes("FOREIGN KEY")
}

async function recordRuns(runs: DbJobRunInsert[]) {
  const db = getDb()
  const [first, ...rest] = runs.map(run => db.insert(jobRuns).values(run))
  if (first == null) return

  try {
    await db.batch([first, ...rest])
  } catch (err) {
    // A job deleted mid-run fails its foreign key, which rolls back the whole batch.
    logger.warn("Batch insert of job runs failed, retrying one by one", { err })
    const results = await Promise.allSettled(
      runs.map(run => db.insert(jobRuns).values(run)),
    )
    for (const result of results) {
      if (result.status === "rejected" && !isForeignKeyError(result.reason)) {
        logger.error("Failed to record job run", { err: result.reason })
      }
    }
  }
}

export async function runDueJobs(scheduledTime: number) {
  const minuteStart = new Date(
    Math.floor(scheduledTime / MINUTE_MS) * MINUTE_MS,
  )
  const runnable = await getRunnableJobs()
  const due = runnable.filter(job =>
    firesWithinMinute(job.cronExpression, minuteStart),
  )
  logger.debug("Scheduler tick", {
    minute: minuteStart.toISOString(),
    runnable: runnable.length,
    due: due.length,
  })

  const runs = await Promise.all(due.map(executeJob))
  await recordRuns(runs)
}
