import { printSchema } from "graphql"
import { schema } from "./schema/index"
import { writeFileSync } from "fs"
import { resolve } from "path"

const schemaString = printSchema(schema)

// Write to the graphql-api root (web's tsconfig references it from there)
const outputPath = resolve(import.meta.dir, "../schema.graphql")
writeFileSync(outputPath, schemaString)

console.log(`Schema written to ${outputPath}`)
console.log("Run: cd apps/web && pnpm gql-tada generate-output")
