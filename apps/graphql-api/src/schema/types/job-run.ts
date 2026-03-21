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

const JobRunEdgeRef = builder
  .objectRef<{ node: DbJobRun; cursor: string }>("JobRunEdge")
  .implement({
    fields: t => ({
      node: t.field({
        type: JobRunRef,
        resolve: edge => edge.node,
      }),
      cursor: t.exposeString("cursor"),
    }),
  })

const PageInfoRef = builder
  .objectRef<{ hasNextPage: boolean; endCursor: string | null }>("PageInfo")
  .implement({
    fields: t => ({
      hasNextPage: t.exposeBoolean("hasNextPage"),
      endCursor: t.field({
        type: "String",
        nullable: true,
        resolve: p => p.endCursor,
      }),
    }),
  })

export const JobRunConnectionRef = builder
  .objectRef<{
    edges: Array<{ node: DbJobRun; cursor: string }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }>("JobRunConnection")
  .implement({
    fields: t => ({
      edges: t.field({
        type: [JobRunEdgeRef],
        resolve: c => c.edges,
      }),
      pageInfo: t.field({
        type: PageInfoRef,
        resolve: c => c.pageInfo,
      }),
    }),
  })
