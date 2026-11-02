import { env as workerEnv } from "cloudflare:workers"
import { z } from "zod"

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
] as const

const envSchema = z
  .object({
    JWT_SECRET: z.string().min(32),
    COMMUNITY_EDITION: z
      .string()
      .default("false")
      .transform(v => v === "true"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_PRO_YEARLY_PRICE_ID: z.string().optional(),
    WEB_URL: z.string().default("http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    if (data.COMMUNITY_EDITION) return
    for (const key of STRIPE_KEYS) {
      if (data[key] == null || data[key].trim() === "") {
        ctx.addIssue({
          code: "custom",
          message: `${key} is required when COMMUNITY_EDITION is false`,
          path: [key],
        })
      }
    }
  })

export const env = envSchema.parse(workerEnv)
