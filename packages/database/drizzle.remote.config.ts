import { defineConfig } from "drizzle-kit"
import { remoteEnv } from "./remote-env"

export default defineConfig({
  schema: "./src/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  casing: "snake_case",
  dbCredentials: {
    accountId: remoteEnv.CLOUDFLARE_ACCOUNT_ID,
    databaseId: remoteEnv.CLOUDFLARE_D1_DATABASE_ID,
    token: remoteEnv.CLOUDFLARE_API_TOKEN,
  },
  verbose: true,
  strict: true,
})
