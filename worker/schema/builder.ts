import SchemaBuilder from "@pothos/core"
import WithInputPlugin from "@pothos/plugin-with-input"
import type { GraphQLContext } from "../context"

export const builder = new SchemaBuilder<{
  Context: GraphQLContext
  DefaultFieldNullability: false
}>({
  plugins: [WithInputPlugin],
  defaultFieldNullability: false,
  withInput: {
    typeOptions: {
      name: ({ fieldName }) => {
        const capitalized = `${fieldName[0]!.toUpperCase()}${fieldName.slice(1)}`
        return `${capitalized}Input`
      },
    },
  },
})

builder.queryType({})
builder.mutationType({})
