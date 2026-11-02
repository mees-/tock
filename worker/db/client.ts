import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import * as schema from "./schema"

const dbEnvSchema = z.object({
  DB: z.custom<D1Database>(value => value != null, "D1 binding DB is missing"),
})

function createDb() {
  const { DB } = dbEnvSchema.parse(env)
  return drizzle(DB, { schema, casing: "snake_case" })
}

export type Database = ReturnType<typeof createDb>

let instance: Database | undefined

// Bindings are absent while Cloudflare validates the script at deploy time, so
// connect on first use rather than at import.
export function getDb() {
  instance ??= createDb()
  return instance
}
