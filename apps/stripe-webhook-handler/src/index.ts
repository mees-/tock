import { Hono } from "hono"
import { env } from "./env"
import { handleStripeWebhook } from "./webhook"
import { db } from "database"
import { sql } from "drizzle-orm"
import { stripe } from "./stripe"

const app = new Hono()

app.post("/stripe/webhook", handleStripeWebhook)
app.get("/health", async ctx => {
  try {
    await db.execute(sql`SELECT 1`)
    await stripe.accounts.list()
    return ctx.status(200)
  } catch {
    return ctx.status(500)
  }
})

export default {
  port: env.PORT ?? env.STRIPE_WEBHOOK_HANDLER_PORT,
  fetch: app.fetch,
}
