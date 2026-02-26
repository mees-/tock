import { boolean, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core"

export const USER_ROLES = ["admin", "member"] as const
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export const JOB_RUN_STATUSES = ["success", "failure", "timeout"] as const

export type UserRole = (typeof USER_ROLES)[number]
export type HttpMethod = (typeof HTTP_METHODS)[number]
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number]

export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: varchar({ length: 64 }).notNull().unique(),
  passwordHash: text().notNull(),
  role: text({ enum: USER_ROLES }).notNull().default("member"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const jobs = pgTable("jobs", {
  id: serial().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar({ length: 256 }).notNull(),
  description: text().notNull().default(""),
  endpoint: text().notNull(),
  method: text({ enum: HTTP_METHODS }).notNull().default("GET"),
  headers: jsonb().$type<Record<string, string>>().notNull().default({}),
  body: text(),
  cronExpression: varchar({ length: 128 }).notNull(),
  timezone: varchar({ length: 64 }).notNull().default("UTC"),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export const jobRuns = pgTable("job_runs", {
  id: serial().primaryKey(),
  jobId: integer()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  triggeredAt: timestamp({ withTimezone: true }).notNull(),
  completedAt: timestamp({ withTimezone: true }),
  status: text({ enum: JOB_RUN_STATUSES }).notNull(),
  httpStatusCode: integer(),
  responseBody: text(),
  responseHeaders: text(),
  errorMessage: text(),
  durationMs: integer(),
})

export type DbUser = typeof users.$inferSelect
export type DbUserInsert = typeof users.$inferInsert
export type DbJob = typeof jobs.$inferSelect
export type DbJobInsert = typeof jobs.$inferInsert
export type DbJobRun = typeof jobRuns.$inferSelect
export type DbJobRunInsert = typeof jobRuns.$inferInsert
