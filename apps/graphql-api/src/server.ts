import { createYoga } from "graphql-yoga"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { schema } from "./schema/index"
import { createContext } from "./context"
import { env } from "./env"
import { logger } from "./logger"

export function createServer() {
  const yoga = createYoga<object>({
    schema,
    context: createContext,
    graphiql: env.NODE_ENV === "development",
    cors: false,
  })

  const app = new Hono()

  app.use(cors({ origin: env.CORS_ORIGIN }))

  app.on(["GET", "POST"], "/graphql", c => yoga.handle(c.req.raw, {}))

  return {
    start() {
      logger.info({ port: env.PORT }, `GraphQL API running on http://localhost:${env.PORT}/graphql`)
      return Bun.serve({
        port: env.PORT,
        fetch: app.fetch,
      })
    },
  }
}
