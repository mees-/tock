import { env as workerEnv } from "cloudflare:workers"
import { z } from "zod"

const envSchema = z.object({
  DB: z.custom<D1Database>(value => value != null, "D1 binding DB is missing"),
})

let parsed: z.infer<typeof envSchema> | undefined

// Bindings are absent while Cloudflare validates the script at deploy time, so
// parse on first use rather than at import.
export function getEnv() {
  parsed ??= envSchema.parse(workerEnv)
  return parsed
}
