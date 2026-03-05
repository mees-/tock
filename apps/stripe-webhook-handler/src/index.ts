import { Hono } from "hono"
import { env } from "./env"
import { handleStripeWebhook } from "./webhook"

const app = new Hono()

app.post("/stripe/webhook", handleStripeWebhook)

export default {
  port: env.STRIPE_WEBHOOK_HANDLER_PORT,
  fetch: app.fetch,
}
