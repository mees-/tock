import { z } from "zod"

const exportEnvSchema = z.object({
  DATABASE_URL: z.url(),
})

export const exportEnv = exportEnvSchema.parse(process.env)
