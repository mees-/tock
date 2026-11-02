import { drizzle } from "drizzle-orm/d1"
import { getEnv } from "./env"
import * as schema from "./schema"

function createDb() {
  return drizzle(getEnv().DB, { schema, casing: "snake_case" })
}

export type Database = ReturnType<typeof createDb>

let instance: Database | undefined

export function getDb() {
  instance ??= createDb()
  return instance
}
