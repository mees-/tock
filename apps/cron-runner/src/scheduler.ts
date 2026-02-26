import { Cron } from "croner"
import { db, jobs, jobRuns } from "database"
import type { DbJob, JobRunStatus } from "database"
import { eq } from "drizzle-orm"
import { logger } from "./logger"

const MAX_RESPONSE_BODY_LENGTH = 10_000

// Map from job id → { cron instance, last known updatedAt }
const cronMap = new Map<number, { cron: Cron; updatedAt: string }>()

async function executeJob(jobId: number) {
  // Re-fetch the full job row so we always use the latest endpoint/headers/body.
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (job == null) {
    logger.debug({ jobId }, "Job deleted, skipping execution")
    return
  }

  const triggeredAt = new Date()
  const start = Date.now()

  let durationMs = 0
  let status: JobRunStatus = "failure"
  let httpStatusCode: number | undefined
  let responseBody: string | undefined
  let responseHeaders: string | undefined
  let errorMessage: string | undefined

  // Phase 1: HTTP request
  try {
    const response = await fetch(job.endpoint, {
      method: job.method,
      headers: { "Content-Type": "application/json", ...job.headers },
      body: job.body ?? undefined,
      signal: AbortSignal.timeout(30_000),
    })

    durationMs = Date.now() - start
    const rawBody = await response.text()
    const truncated = rawBody.length > MAX_RESPONSE_BODY_LENGTH
    responseBody = truncated ? rawBody.slice(0, MAX_RESPONSE_BODY_LENGTH) + "\n[truncated]" : rawBody
    responseHeaders = JSON.stringify(Object.fromEntries(response.headers.entries()))
    httpStatusCode = response.status
    status = response.ok ? "success" : "failure"

    logger.info(
      {
        jobId: job.id,
        name: job.name,
        url: job.endpoint,
        method: job.method,
        statusCode: httpStatusCode,
        durationMs,
        success: response.ok,
      },
      "Job executed",
    )
  } catch (err) {
    durationMs = Date.now() - start
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError"
    status = isTimeout ? "timeout" : "failure"
    errorMessage = err instanceof Error ? err.message : String(err)
    logger.error({ jobId: job.id, name: job.name, err, isTimeout }, "Job failed")
  }

  // Phase 2: record the run — if the job was deleted between sync cycles the
  // FK constraint will fire; catch only that case and discard it.
  try {
    await db.insert(jobRuns).values({
      jobId: job.id,
      triggeredAt,
      completedAt: new Date(),
      status,
      httpStatusCode,
      responseBody,
      responseHeaders,
      errorMessage,
      durationMs,
    })
  } catch (err) {
    // Postgres FK violation (23503) means the job was deleted mid-flight.
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "23503") {
      logger.debug({ jobId: job.id }, "Job deleted before run could be recorded, discarding")
    } else {
      logger.error({ jobId: job.id, err }, "Failed to record job run")
    }
  }
}

function startJob(job: DbJob) {
  const cron = new Cron(job.cronExpression, { timezone: job.timezone, protect: true }, () => executeJob(job.id))
  cronMap.set(job.id, { cron, updatedAt: job.updatedAt.toISOString() })
  logger.debug({ jobId: job.id, name: job.name, cron: job.cronExpression }, "Cron started")
}

export async function syncJobs() {
  const activeJobs = await db.select().from(jobs).where(eq(jobs.isActive, true))

  const activeIds = new Set(activeJobs.map(j => j.id))

  // Stop crons for jobs that are no longer active
  for (const [id, { cron }] of cronMap) {
    if (!activeIds.has(id)) {
      cron.stop()
      cronMap.delete(id)
      logger.debug({ jobId: id }, "Cron stopped")
    }
  }

  // Add new crons or replace changed ones
  for (const job of activeJobs) {
    const existing = cronMap.get(job.id)
    const jobUpdatedAt = job.updatedAt.toISOString()

    if (existing != null && existing.updatedAt === jobUpdatedAt) {
      // No change
      continue
    }

    // Stop existing if being replaced
    if (existing != null) {
      existing.cron.stop()
      logger.debug({ jobId: job.id }, "Cron replaced (job updated)")
    }

    startJob(job)
  }
}
