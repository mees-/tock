import { z } from "zod"

const envSchema = z
  .object({
    GRAPHQL_API_PORT: z.coerce.number().default(4000),
    PORT: z.coerce.number().optional(),
    JWT_SECRET: z.string().min(32),
    COMMUNITY_EDITION: z
      .string()
      .default("false")
      .transform(v => v === "true"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_PRO_YEARLY_PRICE_ID: z.string().optional(),
    WEB_URL: z.string().default("http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    if (!data.COMMUNITY_EDITION) {
      for (const key of [
        "STRIPE_SECRET_KEY",
        "STRIPE_PRO_MONTHLY_PRICE_ID",
        "STRIPE_PRO_YEARLY_PRICE_ID",
      ] satisfies (keyof typeof data)[]) {
        if (data[key] == null || data[key].trim() === "") {
          ctx.addIssue({
            code: "custom",
            message: `${key} is required when COMMUNITY_EDITION is false`,
            path: [key],
          })
        }
      }
    }
  })

export const env = envSchema.parse(process.env)
