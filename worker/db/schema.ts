import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const USER_ROLES = ["admin", "member"] as const
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export const JOB_RUN_STATUSES = ["success", "failure", "timeout"] as const
export const SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "incomplete",
] as const

export type UserRole = (typeof USER_ROLES)[number]
export type HttpMethod = (typeof HTTP_METHODS)[number]
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number]
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

const timestamp = () => integer({ mode: "timestamp_ms" })

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  username: text({ length: 64 }).notNull().unique(),
  passwordHash: text().notNull(),
  role: text({ enum: USER_ROLES }).notNull().default("member"),
  createdAt: timestamp()
    .notNull()
    .$defaultFn(() => new Date()),
  stripeCustomerId: text().unique(),
  subscriptionStatus: text({ enum: SUBSCRIPTION_STATUSES }),
  subscriptionStatusUpdatedAt: timestamp(),
})

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text({ length: 256 }).notNull(),
    description: text().notNull().default(""),
    endpoint: text().notNull(),
    method: text({ enum: HTTP_METHODS }).notNull().default("GET"),
    headers: text({ mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .$defaultFn(() => ({})),
    body: text(),
    cronExpression: text({ length: 128 }).notNull(),
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: timestamp()
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp()
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  t => [index("jobs_user_id_idx").on(t.userId)],
)

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    jobId: integer()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    triggeredAt: timestamp().notNull(),
    completedAt: timestamp(),
    status: text({ enum: JOB_RUN_STATUSES }).notNull(),
    httpStatusCode: integer(),
    responseBody: text(),
    responseHeaders: text(),
    errorMessage: text(),
    durationMs: integer(),
  },
  t => [
    index("job_runs_job_id_triggered_at_idx").on(t.jobId, t.triggeredAt),
    index("job_runs_status_triggered_at_idx").on(t.status, t.triggeredAt),
  ],
)

export type DbUser = typeof users.$inferSelect
export type DbUserInsert = typeof users.$inferInsert

export type DbJob = typeof jobs.$inferSelect
export type DbJobInsert = typeof jobs.$inferInsert
export type DbJobRun = typeof jobRuns.$inferSelect
export type DbJobRunInsert = typeof jobRuns.$inferInsert
