import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SYNC_INTERVAL_MS: z.coerce.number().min(500).max(300_000).default(1_000),
})

export const env = envSchema.parse(process.env)
