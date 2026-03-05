import { z } from "zod"

const envSchema = z.object({
  GRAPHQL_API_PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  ALLOW_SIGNUP: z
    .string()
    .default("false")
    .transform(v => v === "true"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string(),
  STRIPE_PRO_YEARLY_PRICE_ID: z.string(),
  WEB_URL: z.string().default("http://localhost:5173"),
})

export const env = envSchema.parse(process.env)
