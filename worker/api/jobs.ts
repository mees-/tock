import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { isValidCronExpression } from "../cron"
import { getDb } from "../db/client"
import { HTTP_METHODS, JOB_RUN_STATUSES, jobRuns, jobs } from "../db/schema"
import type { DbJob, DbUser } from "../db/schema"
import { FREE_JOB_LIMIT, isProAccessActive } from "../db/subscription"
import { env } from "../env"
import { requireUser } from "./auth"
import type { AuthEnv } from "./auth"
import { validate } from "./http"

const HEALTH_WINDOW = 100
const FLAKY_THRESHOLD = 0.2
const FAILING_THRESHOLD = 0.5
const DEFAULT_RUNS_PAGE_SIZE = 50
const MAX_RUNS_PAGE_SIZE = 200
const JOB_NAME_MAX_LENGTH = 256

const jobFieldsSchema = z.object({
  name: z.string().trim().min(1).max(JOB_NAME_MAX_LENGTH),
  description: z.string(),
  endpoint: z.url({ protocol: /^https?$/ }),
  method: z.enum(HTTP_METHODS),
  headers: z.record(z.string(), z.string()),
  body: z.string().nullable(),
  cronExpression: z
    .string()
    .trim()
    .refine(
      isValidCronExpression,
      "Invalid cron expression. Use 5 fields: minute hour day month weekday",
    ),
})

const createJobSchema = jobFieldsSchema.partial({
  description: true,
  headers: true,
  body: true,
})

const updateJobSchema = jobFieldsSchema
  .partial()
  .refine(fields => Object.keys(fields).length > 0, "No fields to update")

const jobIdSchema = z.object({ id: z.coerce.number().int().positive() })

const runsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RUNS_PAGE_SIZE)
    .default(DEFAULT_RUNS_PAGE_SIZE),
  before: z.coerce.number().int().optional(),
  status: z
    .string()
    .transform(value => value.split(","))
    .pipe(z.array(z.enum(JOB_RUN_STATUSES)))
    .optional(),
})

function jobNotFound() {
  return new HTTPException(404, { message: "Job not found" })
}

async function findJob(user: DbUser, id: number) {
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
    .limit(1)
  if (job == null) throw jobNotFound()
  return job
}

export type JobHealth = "active" | "flaky" | "failing" | "paused"

async function jobHealth(job: DbJob): Promise<JobHealth> {
  if (!job.isActive) return "paused"
  const runs = await getDb()
    .select({ status: jobRuns.status })
    .from(jobRuns)
    .where(eq(jobRuns.jobId, job.id))
    .orderBy(desc(jobRuns.triggeredAt))
    .limit(HEALTH_WINDOW)
  if (runs.length === 0) return "active"
  const failureRate =
    runs.filter(r => r.status !== "success").length / runs.length
  if (failureRate >= FAILING_THRESHOLD) return "failing"
  if (failureRate >= FLAKY_THRESHOLD) return "flaky"
  return "active"
}

async function withHealth(job: DbJob) {
  return { ...job, status: await jobHealth(job) }
}

async function assertBelowJobLimit(user: DbUser) {
  if (env.COMMUNITY_EDITION || isProAccessActive(user)) return
  const [{ jobCount }] = await getDb()
    .select({ jobCount: count() })
    .from(jobs)
    .where(eq(jobs.userId, user.id))
  if (jobCount >= FREE_JOB_LIMIT) {
    throw new HTTPException(403, {
      message: "Job limit reached. Upgrade to Pro for unlimited jobs.",
    })
  }
}

export const jobsApi = new Hono<AuthEnv>()
  .use(requireUser)
  .get("/", async c => {
    const rows = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.userId, c.var.user.id))
      .orderBy(desc(jobs.createdAt))
    return c.json(await Promise.all(rows.map(withHealth)))
  })
  .post("/", validate("json", createJobSchema), async c => {
    const user = c.var.user
    await assertBelowJobLimit(user)
    const input = c.req.valid("json")
    const [job] = await getDb()
      .insert(jobs)
      .values({ ...input, userId: user.id })
      .returning()
    if (job == null) throw new Error("Insert returned no job")
    return c.json(await withHealth(job), 201)
  })
  .get("/:id", validate("param", jobIdSchema), async c => {
    const job = await findJob(c.var.user, c.req.valid("param").id)
    return c.json(await withHealth(job))
  })
  .patch(
    "/:id",
    validate("param", jobIdSchema),
    validate("json", updateJobSchema),
    async c => {
      const [job] = await getDb()
        .update(jobs)
        .set(c.req.valid("json"))
        .where(
          and(
            eq(jobs.id, c.req.valid("param").id),
            eq(jobs.userId, c.var.user.id),
          ),
        )
        .returning()
      if (job == null) throw jobNotFound()
      return c.json(await withHealth(job))
    },
  )
  .delete("/:id", validate("param", jobIdSchema), async c => {
    const deleted = await getDb()
      .delete(jobs)
      .where(
        and(
          eq(jobs.id, c.req.valid("param").id),
          eq(jobs.userId, c.var.user.id),
        ),
      )
      .returning({ id: jobs.id })
    if (deleted.length === 0) throw jobNotFound()
    return c.body(null, 204)
  })
  .post("/:id/toggle", validate("param", jobIdSchema), async c => {
    const [job] = await getDb()
      .update(jobs)
      .set({ isActive: sql`NOT ${jobs.isActive}` })
      .where(
        and(
          eq(jobs.id, c.req.valid("param").id),
          eq(jobs.userId, c.var.user.id),
        ),
      )
      .returning()
    if (job == null) throw jobNotFound()
    return c.json(await withHealth(job))
  })
  .get(
    "/:id/runs",
    validate("param", jobIdSchema),
    validate("query", runsQuerySchema),
    async c => {
      const job = await findJob(c.var.user, c.req.valid("param").id)
      const { limit, before, status } = c.req.valid("query")
      const rows = await getDb()
        .select()
        .from(jobRuns)
        .where(
          and(
            eq(jobRuns.jobId, job.id),
            before != null ? lt(jobRuns.id, before) : undefined,
            status != null && status.length > 0
              ? inArray(jobRuns.status, status)
              : undefined,
          ),
        )
        .orderBy(desc(jobRuns.triggeredAt))
        .limit(limit + 1)
      const hasMore = rows.length > limit
      const runs = hasMore ? rows.slice(0, limit) : rows
      return c.json({
        runs,
        nextCursor: hasMore ? (runs[runs.length - 1]?.id ?? null) : null,
      })
    },
  )
