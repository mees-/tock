import { builder } from "../builder"
import type { DbJobRun } from "database"

export const JobRunRef = builder.objectRef<DbJobRun>("JobRun").implement({
  fields: t => ({
    id: t.exposeInt("id", { nullable: false }),
    jobId: t.exposeInt("jobId", { nullable: false }),
    triggeredAt: t.field({
      type: "String",
      nullable: false,
      resolve: r => r.triggeredAt.toISOString(),
    }),
    completedAt: t.field({
      type: "String",
      nullable: true,
      resolve: r => r.completedAt?.toISOString() ?? null,
    }),
    status: t.exposeString("status", { nullable: false }),
    httpStatusCode: t.exposeInt("httpStatusCode", { nullable: true }),
    responseBody: t.exposeString("responseBody", { nullable: true }),
    responseHeaders: t.exposeString("responseHeaders", { nullable: true }),
    errorMessage: t.exposeString("errorMessage", { nullable: true }),
    durationMs: t.exposeInt("durationMs", { nullable: true }),
  }),
})

export const JobRunConnectionRef = builder
  .objectRef<{ runs: DbJobRun[]; total: number }>("JobRunConnection")
  .implement({
    fields: t => ({
      runs: t.field({
        type: [JobRunRef],
        nullable: false,
        resolve: c => c.runs,
      }),
      total: t.exposeInt("total", { nullable: false }),
    }),
  })
