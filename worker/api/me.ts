import { and, count, eq, gte } from "drizzle-orm"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { DateTime } from "luxon"
import { z } from "zod"
import { hashPassword, verifyPassword } from "../auth/password"
import { getDb } from "../db/client"
import { jobRuns, jobs, users } from "../db/schema"
import {
  FREE_JOB_LIMIT,
  gracePeriodEndsAt,
  isProAccessActive,
} from "../db/subscription"
import { env } from "../env"
import { passwordSchema, requireUser } from "./auth"
import type { AuthEnv } from "./auth"
import { validate } from "./http"

export const meApi = new Hono<AuthEnv>()
  .use(requireUser)
  .get("/stats", async c => {
    const db = getDb()
    const userId = c.var.user.id
    const dayAgo = DateTime.now().minus({ days: 1 }).toJSDate()
    const todayStart = DateTime.now().startOf("day").toJSDate()

    const [[{ totalJobs }], [{ activeJobs }], [{ totalRunsToday }], recent] =
      await Promise.all([
        db
          .select({ totalJobs: count() })
          .from(jobs)
          .where(eq(jobs.userId, userId)),
        db
          .select({ activeJobs: count() })
          .from(jobs)
          .where(and(eq(jobs.userId, userId), eq(jobs.isActive, true))),
        db
          .select({ totalRunsToday: count() })
          .from(jobRuns)
          .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
          .where(
            and(eq(jobs.userId, userId), gte(jobRuns.triggeredAt, todayStart)),
          ),
        db
          .select({ status: jobRuns.status, durationMs: jobRuns.durationMs })
          .from(jobRuns)
          .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
          .where(
            and(eq(jobs.userId, userId), gte(jobRuns.triggeredAt, dayAgo)),
          ),
      ])

    const successes = recent.filter(r => r.status === "success").length
    const durations = recent.map(r => r.durationMs).filter(d => d != null)

    return c.json({
      totalJobs,
      activeJobs,
      totalRunsToday,
      successRateLast24h: recent.length === 0 ? 0 : successes / recent.length,
      avgDurationLast24h:
        durations.length === 0
          ? null
          : durations.reduce((a, b) => a + b, 0) / durations.length,
    })
  })
  .get("/subscription", async c => {
    const user = c.var.user
    const [{ jobCount }] = await getDb()
      .select({ jobCount: count() })
      .from(jobs)
      .where(eq(jobs.userId, user.id))

    if (env.COMMUNITY_EDITION) {
      return c.json({
        tier: "pro" as const,
        status: null,
        jobLimit: null,
        jobCount,
        isActive: true,
        gracePeriodEndsAt: null,
      })
    }

    const isActive = isProAccessActive(user)
    return c.json({
      tier: isActive ? ("pro" as const) : ("free" as const),
      status: user.subscriptionStatus,
      jobLimit: isActive ? null : FREE_JOB_LIMIT,
      jobCount,
      isActive,
      gracePeriodEndsAt: gracePeriodEndsAt(user)?.toISO() ?? null,
    })
  })
  .put(
    "/password",
    validate(
      "json",
      z.object({ currentPassword: z.string(), newPassword: passwordSchema }),
    ),
    async c => {
      const user = c.var.user
      const { currentPassword, newPassword } = c.req.valid("json")
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new HTTPException(400, {
          message: "Incorrect current password",
        })
      }
      await getDb()
        .update(users)
        .set({ passwordHash: await hashPassword(newPassword) })
        .where(eq(users.id, user.id))
      return c.body(null, 204)
    },
  )
