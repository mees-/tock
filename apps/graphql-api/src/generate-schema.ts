import { printSchema } from "graphql"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { schema } from "./schema/index"

// Write to the graphql-api root (web's tsconfig references it from there)
const outputPath = resolve(import.meta.dirname, "../schema.graphql")
writeFileSync(outputPath, printSchema(schema))

console.log(`Schema written to ${outputPath}`)
console.log("Run: cd apps/web && pnpm gql-tada")
