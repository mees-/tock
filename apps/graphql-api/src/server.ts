import { createYoga } from "graphql-yoga"
import { Hono } from "hono"
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

  app.on(["GET", "POST"], "/graphql", c => yoga.handle(c.req.raw, {}))

  return {
    start() {
      const server = Bun.serve({
        port: env.PORT,
        fetch: app.fetch,
      })
      logger.info(
        { port: server.port, host: server.hostname },
        `GraphQL API running on http://${server.hostname}:${env.PORT}/graphql`,
      )
      return {
        stop: () => server.stop(),
        port: server.port,
        hostname: server.hostname,
      }
    },
  }
}
