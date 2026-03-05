import { db, users } from "database"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import Stripe from "stripe"
import { env } from "./env"

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

export async function handleStripeWebhook(c: Context) {
  const body = await c.req.text()
  const sig = c.req.header("stripe-signature")

  if (sig == null) {
    console.log("Missing stripe signature")
    return c.text("Missing stripe-signature header", 400)
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.log("Stripe construct error", err)
    return c.text(`Webhook signature verification failed: ${err}`, 400)
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const userId = session.client_reference_id
      const customerId = session.customer as string | null

      if (userId == null || customerId == null) break

      await db
        .update(users)
        .set({
          stripeCustomerId: customerId,
          subscriptionTier: "pro",
          subscriptionStatus: "active",
        })
        .where(eq(users.id, parseInt(userId, 10)))
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object
      const customerId = subscription.customer as string
      const status = subscription.status

      // for proper typecasting
      const shouldHandleStatus = (
        s: string,
      ): s is "active" | "past_due" | "incomplete" | "canceled" =>
        ["active", "past_due", "incomplete", "canceled"].includes(status)

      if (!shouldHandleStatus(status)) break

      await db
        .update(users)
        .set({ subscriptionStatus: status })
        .where(eq(users.stripeCustomerId, customerId))
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object
      const customerId = subscription.customer as string

      await db
        .update(users)
        .set({ subscriptionTier: "free", subscriptionStatus: "canceled" })
        .where(eq(users.stripeCustomerId, customerId))
      break
    }
  }

  return c.json({ received: true })
}
