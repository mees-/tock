import { builder } from "../builder"
import { UserRef } from "../types/user"
import { JobRef } from "../types/job"
import { jobs, users } from "database"
import { eq, and, desc } from "drizzle-orm"
import { NotFoundError } from "../../errors"
import { env } from "../../env"
import { db } from "database"

builder.queryField("me", t =>
  t.field({
    type: UserRef,
    resolve: async (_root, _args, ctx) => {
      return ctx.requireAuth()
    },
  }),
)

export async function canSignup(database: typeof db) {
  if (env.ALLOW_SIGNUP) {
    return true
  }

  const count = await database.$count(users)
  return count === 0
}

builder.queryField("canSignup", t =>
  t.boolean({
    resolve: async (_root, _args, ctx) => {
      return await canSignup(ctx.db)
    },
  }),
)

builder.queryField("jobs", t =>
  t.field({
    type: [JobRef],
    resolve: async (_root, _args, ctx) => {
      const user = ctx.requireAuth()
      return ctx.db
        .select()
        .from(jobs)
        .where(eq(jobs.userId, user.id))
        .orderBy(desc(jobs.createdAt))
    },
  }),
)

builder.queryField("job", t =>
  t.field({
    type: JobRef,
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
