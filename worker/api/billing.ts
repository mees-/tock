import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { getDb } from "../db/client"
import { users } from "../db/schema"
import { env } from "../env"
import { getStripe } from "../stripe"
import { requireUser } from "./auth"
import { validate } from "./http"

async function priceSummary(priceId: string) {
  const price = await getStripe().prices.retrieve(priceId)
  return {
    id: price.id,
    amount: price.unit_amount ?? 0,
  }
}

function knownPriceIds() {
  return new Set([
    env.STRIPE_PRO_MONTHLY_PRICE_ID,
    env.STRIPE_PRO_YEARLY_PRICE_ID,
  ])
}

export const billingApi = new Hono()
  .get("/prices", async c => {
    if (env.COMMUNITY_EDITION) return c.json(null)
    const [monthly, yearly] = await Promise.all([
      priceSummary(env.STRIPE_PRO_MONTHLY_PRICE_ID!),
      priceSummary(env.STRIPE_PRO_YEARLY_PRICE_ID!),
    ])
    return c.json({ monthly, yearly })
  })
  .post(
    "/checkout",
    requireUser,
    validate("json", z.object({ priceId: z.string() })),
    async c => {
      const user = c.var.user
      const { priceId } = c.req.valid("json")
      if (!knownPriceIds().has(priceId)) {
        throw new HTTPException(400, { message: "Invalid price ID" })
      }

      let customerId = user.stripeCustomerId
      if (customerId == null) {
        const customer = await getStripe().customers.create({
          metadata: { userId: String(user.id) },
        })
        customerId = customer.id
        await getDb()
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, user.id))
      }

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        client_reference_id: String(user.id),
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.WEB_URL}/settings/billing?success=true`,
        cancel_url: `${env.WEB_URL}/settings/billing`,
      })
      if (session.url == null) {
        throw new Error("Stripe returned a checkout session without a URL")
      }
      return c.json({ url: session.url })
    },
  )
  .post("/portal", requireUser, async c => {
    const customerId = c.var.user.stripeCustomerId
    if (customerId == null) {
      throw new HTTPException(400, { message: "No billing account found" })
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.WEB_URL}/settings/billing`,
    })
    return c.json({ url: session.url })
  })
