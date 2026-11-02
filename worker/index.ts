import { createYoga } from "graphql-yoga"
import { Hono } from "hono"
import { createContext } from "./context"
import { pruneJobRunsHourly } from "./retention"
import { runDueJobs } from "./scheduler"
import { schema } from "./schema/index"
import { handleStripeWebhook } from "./stripe-webhook"

const yoga = createYoga({
  schema,
  context: createContext,
  graphiql: import.meta.env.DEV,
  cors: {
    origin: "*",
    credentials: false,
  },
})

const app = new Hono()
app.on(["GET", "POST", "OPTIONS"], "/graphql", c => yoga.fetch(c.req.raw))
app.post("/stripe/webhook", handleStripeWebhook)

export default {
  fetch: app.fetch,
  async scheduled(controller) {
    await runDueJobs(controller.scheduledTime)
    await pruneJobRunsHourly(controller.scheduledTime)
  },
} satisfies ExportedHandler
