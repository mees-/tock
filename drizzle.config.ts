import { defineConfig } from "drizzle-kit"
import { globSync } from "node:fs"

// Miniflare stores the local D1 database under a hashed file name.
const LOCAL_D1_GLOB =
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite"

function findLocalD1File() {
  const [file] = globSync(LOCAL_D1_GLOB)
  if (file == null) {
    throw new Error(
      "Local D1 database not found. Run `pnpm setup-db` from the repo root first.",
    )
  }
  return file
}

export default defineConfig({
  schema: "./worker/db/schema.ts",
  dialect: "sqlite",
  casing: "snake_case",
  dbCredentials: { url: findLocalD1File() },
  verbose: true,
  strict: true,
})
