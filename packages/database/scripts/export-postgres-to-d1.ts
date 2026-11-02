/**
 * Dumps the Postgres data as SQLite INSERT statements for `wrangler d1 execute --file`.
 * Usage: bun scripts/export-postgres-to-d1.ts > dump.sql
 */
import { SQL } from "bun"
import { jobRunRetentionCutoffs } from "../src/retention"
import { exportEnv } from "./env"

type Row = Record<string, unknown>

const TABLES = [
  {
    name: "users",
    columns: [
      "id",
      "username",
      "password_hash",
      "role",
      "created_at",
      "stripe_customer_id",
      "subscription_status",
      "subscription_status_updated_at",
    ],
  },
  {
    name: "jobs",
    columns: [
      "id",
      "user_id",
      "name",
      "description",
      "endpoint",
      "method",
      "headers",
      "body",
      "cron_expression",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "job_runs",
    columns: [
      "id",
      "job_id",
      "triggered_at",
      "completed_at",
      "status",
      "http_status_code",
      "response_body",
      "response_headers",
      "error_message",
      "duration_ms",
    ],
  },
] as const

const BATCH_SIZE = 1_000

const cutoffs = jobRunRetentionCutoffs(new Date())
const RETENTION_FILTER: Partial<Record<string, string>> = {
  job_runs:
    "AND ((status = 'success' AND triggered_at >= $3) OR (status <> 'success' AND triggered_at >= $4))",
}

function toSqlLiteral(value: unknown): string {
  if (value == null) return "NULL"
  if (value instanceof Date) return String(value.getTime())
  if (typeof value === "boolean") return value ? "1" : "0"
  if (typeof value === "number" || typeof value === "bigint")
    return String(value)
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return `'${text.replaceAll("'", "''")}'`
}

const sql = new SQL(exportEnv.DATABASE_URL)

for (const table of TABLES) {
  const columnList = table.columns.join(", ")
  let lastId = 0
  while (true) {
    const rows: Row[] = await sql.unsafe(
      `SELECT ${columnList} FROM ${table.name} WHERE id > $1 ${RETENTION_FILTER[table.name] ?? ""} ORDER BY id LIMIT $2`,
      RETENTION_FILTER[table.name] == null
        ? [lastId, BATCH_SIZE]
        : [lastId, BATCH_SIZE, cutoffs.successful, cutoffs.failed],
    )
    if (rows.length === 0) break
    for (const row of rows) {
      const values = table.columns.map(c => toSqlLiteral(row[c])).join(", ")
      process.stdout.write(
        `INSERT INTO ${table.name} (${columnList}) VALUES (${values});\n`,
      )
    }
    lastId = Number(rows[rows.length - 1]!.id)
  }
}

await sql.close()
