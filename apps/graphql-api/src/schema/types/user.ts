import { builder } from "../builder"
import type { DbUser } from "database"
import { jobs, jobRuns } from "database"
import { eq, and, gte, count } from "drizzle-orm"
import { StatsRef } from "./stats"

export const UserRef = builder.objectRef<DbUser>("User").implement({
  fields: t => ({
    id: t.exposeInt("id"),
    username: t.exposeString("username"),
    role: t.exposeString("role"),
    stats: t.field({
      type: StatsRef,
      resolve: async (user, _args, ctx) => {
        ctx.requireAuth()

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const [
          [{ count: jobCount }],
          [{ count: activeCount }],
          [{ count: todayRuns }],
          last24hRuns,
        ] = await Promise.all([
          ctx.db
            .select({ count: count() })
            .from(jobs)
            .where(eq(jobs.userId, user.id)),
          ctx.db
            .select({ count: count() })
            .from(jobs)
            .where(and(eq(jobs.userId, user.id), eq(jobs.isActive, true))),
          ctx.db
            .select({ count: count() })
            .from(jobRuns)
            .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
            .where(
              and(
                eq(jobs.userId, user.id),
                gte(jobRuns.triggeredAt, todayStart),
              ),
            ),
          ctx.db
            .select({
              status: jobRuns.status,
              durationMs: jobRuns.durationMs,
            })
            .from(jobRuns)
            .innerJoin(jobs, eq(jobRuns.jobId, jobs.id))
            .where(
              and(eq(jobs.userId, user.id), gte(jobRuns.triggeredAt, dayAgo)),
            ),
        ])

        const totalLast24h = last24hRuns.length
        const successLast24h = last24hRuns.filter(
          r => r.status === "success",
        ).length
        const successRate =
          totalLast24h === 0 ? 0 : successLast24h / totalLast24h

        const durations = last24hRuns
          .map(r => r.durationMs)
          .filter((d): d is number => d != null)
        const avgDuration =
          durations.length === 0
            ? null
            : durations.reduce((a, b) => a + b, 0) / durations.length

        return {
          totalJobs: jobCount,
          activeJobs: activeCount,
          totalRunsToday: todayRuns,
          successRateLast24h: successRate,
          avgDurationLast24h: avgDuration,
        }
      },
    }),
    createdAt: t.field({
      type: "String",
      nullable: false,
      resolve: u => u.createdAt.toISOString(),
    }),
  }),
})

export const AuthPayloadRef = builder
  .objectRef<{
    token: string
    refreshToken: string
    user: DbUser
  }>("AuthPayload")
  .implement({
    fields: t => ({
      token: t.exposeString("token"),
      refreshToken: t.exposeString("refreshToken"),
      user: t.field({
        type: UserRef,
        nullable: false,
        resolve: p => p.user,
      }),
    }),
  })
