import { builder } from "../builder"
import type { DbJob } from "database"
import { jobRuns } from "database"
import { eq, desc } from "drizzle-orm"

const HEALTH_WINDOW = 100
const FLAKY_THRESHOLD = 0.2
const FAILING_THRESHOLD = 0.5

export const JobRef = builder.objectRef<DbJob>("Job").implement({
  fields: t => ({
    id: t.exposeInt("id", { nullable: false }),
    userId: t.exposeInt("userId", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    description: t.exposeString("description", { nullable: false }),
    endpoint: t.exposeString("endpoint", { nullable: false }),
    method: t.exposeString("method", { nullable: false }),
    headers: t.field({
      type: "String",
      nullable: false,
      resolve: j => JSON.stringify(j.headers),
    }),
    body: t.exposeString("body", { nullable: true }),
    cronExpression: t.exposeString("cronExpression", { nullable: false }),
    timezone: t.exposeString("timezone", { nullable: false }),
    isActive: t.exposeBoolean("isActive", { nullable: false }),
    status: t.field({
      type: "String",
      nullable: false,
      resolve: async (job, _args, ctx) => {
        if (!job.isActive) return "paused"
        const runs = await ctx.db
          .select({ status: jobRuns.status })
          .from(jobRuns)
          .where(eq(jobRuns.jobId, job.id))
          .orderBy(desc(jobRuns.triggeredAt))
          .limit(HEALTH_WINDOW)
        if (runs.length === 0) return "active"
        const nonSuccess = runs.filter(r => r.status !== "success").length
        const rate = nonSuccess / runs.length
        if (rate >= FAILING_THRESHOLD) return "failing"
        if (rate >= FLAKY_THRESHOLD) return "flaky"
        return "active"
      },
    }),
    createdAt: t.field({
      type: "String",
      nullable: false,
      resolve: j => j.createdAt.toISOString(),
    }),
    updatedAt: t.field({
      type: "String",
      nullable: false,
      resolve: j => j.updatedAt.toISOString(),
    }),
  }),
})
