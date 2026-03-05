import { z } from "zod"

const envSchema = z.object({
  STRIPE_WEBHOOK_HANDLER_PORT: z.coerce.number().default(4001),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  DATABASE_URL: z.string(),
})

export const env = envSchema.parse(process.env)
