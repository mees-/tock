import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  ALLOW_SIGNUP: z
    .string()
    .default("false")
    .transform(v => v === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export const env = envSchema.parse(process.env)
