import { createServer as createHttpServer } from "node:http"
import { createYoga } from "graphql-yoga"
import { schema } from "./schema/index"
import { createContext } from "./context"
import { env } from "./env"
import { logger } from "./logger"

export function createServer() {
  const yoga = createYoga({
    schema,
    context: createContext,
    graphiql: env.NODE_ENV === "development",
    cors: {
      origin: "*",
      credentials: false,
    },
  })

  const server = createHttpServer(yoga)

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT },
      `GraphQL API running on http://0.0.0.0:${env.PORT}/graphql`,
    )
  })
}
