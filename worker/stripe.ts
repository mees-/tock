import Stripe from "stripe"
import { env } from "./env"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (env.COMMUNITY_EDITION) {
    throw new Error("Stripe is not available in community edition")
  }
  if (_stripe == null) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}
