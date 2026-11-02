import { Hono } from "hono"
import { api } from "./api/index"
import { handleError } from "./api/http"
import { pruneJobRunsHourly } from "./retention"
import { runDueJobs } from "./scheduler"
import { handleStripeWebhook } from "./stripe-webhook"

const app = new Hono()
app.route("/api", api)
app.post("/stripe/webhook", handleStripeWebhook)
app.onError(handleError)

export default {
  fetch: app.fetch,
  async scheduled(controller) {
    await runDueJobs(controller.scheduledTime)
    await pruneJobRunsHourly(controller.scheduledTime)
  },
} satisfies ExportedHandler
