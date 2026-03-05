import { builder } from "../builder"
import { getStripe } from "../../stripe"
import { env } from "../../env"

export const FREE_JOB_LIMIT = 1

export type SubscriptionData = {
  tier: string
  status: string | null
  jobLimit: number | null
  jobCount: number
}

export const SubscriptionRef = builder
  .objectRef<SubscriptionData>("Subscription")
  .implement({
    fields: t => ({
      tier: t.exposeString("tier"),
      status: t.exposeString("status", { nullable: true }),
      jobLimit: t.exposeInt("jobLimit", {
        nullable: true,
        description: "null means unlimited",
      }),
      jobCount: t.exposeInt("jobCount"),
    }),
  })

type PricingPrice = { id: string; interval: string; amount: number }

export const PricingPriceRef = builder
  .objectRef<PricingPrice>("PricingPrice")
  .implement({
    fields: t => ({
      id: t.exposeString("id"),
      interval: t.exposeString("interval"),
      amount: t.exposeInt("amount"),
    }),
  })

export const PricingRef = builder
  .objectRef<Record<string, never>>("PricingPrices")
  .implement({
    fields: t => ({
      monthly: t.field({
        type: PricingPriceRef,
        nullable: false,
        resolve: async () => {
          const price = await getStripe().prices.retrieve(
            env.STRIPE_PRO_MONTHLY_PRICE_ID!,
          )
          return {
            id: price.id,
            interval: price.recurring?.interval ?? "month",
            amount: price.unit_amount ?? 0,
          }
        },
      }),
      yearly: t.field({
        type: PricingPriceRef,
        nullable: false,
        resolve: async () => {
          const price = await getStripe().prices.retrieve(
            env.STRIPE_PRO_YEARLY_PRICE_ID!,
          )
          return {
            id: price.id,
            interval: price.recurring?.interval ?? "year",
            amount: price.unit_amount ?? 0,
          }
        },
      }),
    }),
  })
