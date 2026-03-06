import { Hono } from "hono"
import { env } from "./env"
import { serve } from "@hono/node-server"
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
    return ctx.status(200)
  }
})

serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: env.PORT ?? env.STRIPE_WEBHOOK_HANDLER_PORT,
})

console.log(
  { port: env.PORT ?? env.STRIPE_WEBHOOK_HANDLER_PORT },
  `GraphQL API running on http://0.0.0.0:${env.PORT ?? env.STRIPE_WEBHOOK_HANDLER_PORT}/graphql`,
)
