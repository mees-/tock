import { builder } from "../builder"
import { UserRef } from "../types/user"
import { JobRef } from "../types/job"
import { JobRunConnectionRef } from "../types/job-run"
import { StatsRef } from "../types/stats"
import { jobs, jobRuns, users } from "database"
import { eq, gte, count, sql, and, desc } from "drizzle-orm"
import { NotFoundError } from "../../errors"

builder.queryField("me", t =>
  t.field({
    type: UserRef,
    nullable: false,
    resolve: async (_root, _args, ctx) => {
      return ctx.requireAuth()
    },
  }),
)

builder.queryField("hasUsers", t =>
  t.boolean({
    nullable: false,
    resolve: async (_root, _args, ctx) => {
      const [row] = await ctx.db.select({ cnt: count() }).from(users)
      return (row?.cnt ?? 0) > 0
    },
  }),
)

builder.queryField("jobs", t =>
  t.field({
    type: [JobRef],
    nullable: false,
    resolve: async (_root, _args, ctx) => {
      const user = ctx.requireAuth()
      return ctx.db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.createdAt))
    },
  }),
)

builder.queryField("job", t =>
  t.field({
    type: JobRef,
    nullable: false,
    args: { id: t.arg.int({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const user = ctx.requireAuth()
      const [job] = await ctx.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, args.id), eq(jobs.userId, user.id)))
        .limit(1)
      if (job == null) throw new NotFoundError("Job")
      return job
    },
  }),
)

const MAX_PAGINATION_LIMIT = 500

builder.queryField("jobRuns", t =>
  t.field({
    type: JobRunConnectionRef,
    nullable: false,
    args: {
      jobId: t.arg.int({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 50 }),
      offset: t.arg.int({ required: false, defaultValue: 0 }),
    },
    resolve: async (_root, args, ctx) => {
      const user = ctx.requireAuth()
      // Verify job belongs to user
      const [job] = await ctx.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, args.jobId), eq(jobs.userId, user.id)))
        .limit(1)
      if (job == null) throw new NotFoundError("Job")

      const limit = Math.min(args.limit ?? 50, MAX_PAGINATION_LIMIT)
      const offset = args.offset ?? 0

      const [runs, [countRow]] = await Promise.all([
        ctx.db
          .select()
          .from(jobRuns)
          .where(eq(jobRuns.jobId, args.jobId))
          .orderBy(desc(jobRuns.triggeredAt))
          .limit(limit)
          .offset(offset),
        ctx.db.select({ cnt: count() }).from(jobRuns).where(eq(jobRuns.jobId, args.jobId)),
      ])

      return { runs, total: countRow?.cnt ?? 0 }
    },
  }),
)

builder.queryField("stats", t =>
  t.field({
    type: StatsRef,
    nullable: false,
    resolve: async (_root, _args, ctx) => {
      const user = ctx.requireAuth()

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [[jobCountRow], [activeCountRow], [todayRunsRow], last24hRuns] = await Promise.all([
        ctx.db.select({ cnt: count() }).from(jobs).where(eq(jobs.userId, user.id)),
        ctx.db
          .select({ cnt: count() })
          .from(jobs)
          .where(and(eq(jobs.userId, user.id), eq(jobs.isActive, true))),
        ctx.db
          .select({ cnt: count() })
          .from(jobRuns)
          .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
          .where(and(eq(jobs.userId, user.id), gte(jobRuns.triggeredAt, todayStart))),
        ctx.db
          .select({
            status: jobRuns.status,
            durationMs: jobRuns.durationMs,
          })
          .from(jobRuns)
          .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
          .where(and(eq(jobs.userId, user.id), gte(jobRuns.triggeredAt, dayAgo))),
      ])

      const totalLast24h = last24hRuns.length
      const successLast24h = last24hRuns.filter(r => r.status === "success").length
      const successRate = totalLast24h === 0 ? 0 : successLast24h / totalLast24h

      const durations = last24hRuns.map(r => r.durationMs).filter((d): d is number => d != null)
      const avgDuration = durations.length === 0 ? null : durations.reduce((a, b) => a + b, 0) / durations.length

      return {
        totalJobs: jobCountRow?.cnt ?? 0,
        activeJobs: activeCountRow?.cnt ?? 0,
        totalRunsToday: todayRunsRow?.cnt ?? 0,
        successRateLast24h: successRate,
        avgDurationLast24h: avgDuration,
      }
    },
  }),
)
