import { getDb } from "./db/client"
import { users } from "./db/schema"
import type { SubscriptionStatus } from "./db/schema"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import type Stripe from "stripe"
import { env } from "./env"
import { logger } from "./logger"
import { getStripe } from "./stripe"

const HANDLED_SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "incomplete",
  "canceled",
] as const satisfies SubscriptionStatus[]

function isHandledStatus(
  status: string,
): status is (typeof HANDLED_SUBSCRIPTION_STATUSES)[number] {
  return (HANDLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
}

export async function handleStripeWebhook(c: Context) {
  if (env.COMMUNITY_EDITION) return c.notFound()

  const body = await c.req.text()
  const sig = c.req.header("stripe-signature")
  if (sig == null) return c.text("Missing stripe-signature header", 400)

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    logger.warn("Stripe webhook signature verification failed", { err })
    return c.text("Webhook signature verification failed", 400)
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const userId = session.client_reference_id
      const customerId = session.customer as string | null
      if (userId == null || customerId == null) break

      await getDb()
        .update(users)
        .set({
          stripeCustomerId: customerId,
          subscriptionStatus: "active",
          subscriptionStatusUpdatedAt: new Date(),
        })
        .where(eq(users.id, parseInt(userId, 10)))
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object
      if (!isHandledStatus(subscription.status)) break

      await getDb()
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          subscriptionStatusUpdatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, subscription.customer as string))
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object
      await getDb()
        .update(users)
        .set({
          subscriptionStatus: "canceled",
          subscriptionStatusUpdatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, subscription.customer as string))
      break
    }
  }

  return c.json({ received: true })
}
