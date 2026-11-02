import { z } from "zod"

const remoteEnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_D1_DATABASE_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
})

export const remoteEnv = remoteEnvSchema.parse(process.env)
