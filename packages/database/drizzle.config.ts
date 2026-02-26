import { defineConfig } from "drizzle-kit"
import { env } from "./src/env"

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: env.DATABASE_URL },
  verbose: true,
  strict: true,
})
