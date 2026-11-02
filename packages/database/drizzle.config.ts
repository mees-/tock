import { defineConfig } from "drizzle-kit"
import { globSync } from "node:fs"
import { resolve } from "node:path"

// Miniflare stores the local D1 database under a hashed file name. drizzle-kit
// runs from this package's directory.
const LOCAL_D1_GLOB = resolve(
  "../../apps/graphql-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite",
)

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
  schema: "./src/schema.ts",
  dialect: "sqlite",
  casing: "snake_case",
  dbCredentials: { url: findLocalD1File() },
  verbose: true,
  strict: true,
})
