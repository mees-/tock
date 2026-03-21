import { builder } from "../builder"
import type { DbJob } from "database"
import { jobRuns } from "database"
import { eq, desc, and, lt } from "drizzle-orm"
import { JobRunConnectionRef } from "./job-run"

const HEALTH_WINDOW = 100
const FLAKY_THRESHOLD = 0.2
const FAILING_THRESHOLD = 0.5

export const JobRef = builder.objectRef<DbJob>("Job").implement({
  fields: t => ({
    id: t.exposeInt("id"),
    userId: t.exposeInt("userId"),
    name: t.exposeString("name"),
    description: t.exposeString("description"),
    endpoint: t.exposeString("endpoint"),
    method: t.exposeString("method"),
    headers: t.field({
      type: "String",
      nullable: false,
      resolve: j => JSON.stringify(j.headers),
    }),
    body: t.exposeString("body", { nullable: true }),
    cronExpression: t.exposeString("cronExpression"),
    isActive: t.exposeBoolean("isActive"),
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
    runs: t.field({
      type: JobRunConnectionRef,
      args: {
        first: t.arg.int({ defaultValue: 25, required: false }),
        after: t.arg.string({ required: false }),
      },
      resolve: async (job, { first, after }, ctx) => {
        const limit = first ?? 25
        const afterId = after != null ? parseInt(after) : null
        const rows = await ctx.db
          .select()
          .from(jobRuns)
          .where(
            and(
              eq(jobRuns.jobId, job.id),
              afterId != null ? lt(jobRuns.id, afterId) : undefined,
            ),
          )
          .limit(limit + 1)
          .orderBy(desc(jobRuns.triggeredAt))
        const hasNextPage = rows.length > limit
        const nodes = hasNextPage ? rows.slice(0, limit) : rows
        return {
          edges: nodes.map(node => ({
            node,
            cursor: String(node.id),
          })),
          pageInfo: {
            hasNextPage,
            endCursor:
              nodes.length > 0 ? String(nodes[nodes.length - 1]!.id) : null,
          },
        }
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
