import { Hono } from "hono"
import { env } from "./env"
import type { Serve } from "bun"
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
    ctx.status(200)
    return ctx.body("OK")
  } catch {
    ctx.status(500)
    return ctx.body("ERROR")
  }
})

export default {
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: env.PORT ?? env.STRIPE_WEBHOOK_HANDLER_PORT,
} satisfies Serve.Options<undefined>
