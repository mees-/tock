import { printSchema } from "graphql"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { schema } from "../worker/schema/index"

const outputPath = resolve(import.meta.dirname, "../schema.graphql")
writeFileSync(outputPath, printSchema(schema))

console.log(`Schema written to ${outputPath}`)
console.log("Run: pnpm gql-tada")
