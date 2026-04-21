import { DateTime } from "luxon"
import type { SubscriptionStatus } from "./schema"

const GRACE_PERIODS_MS: Partial<Record<SubscriptionStatus, number>> = {
  incomplete: 24 * 60 * 60 * 1000,
  past_due: 7 * 24 * 60 * 60 * 1000,
}

type UserSubscriptionFields = {
  subscriptionStatus: SubscriptionStatus | null
  subscriptionStatusUpdatedAt: Date | null
}

export function isProAccessActive(user: UserSubscriptionFields): boolean {
  const status = user.subscriptionStatus
  if (status === "active") return true
  if (status == null || status === "canceled") return false
  const ms = GRACE_PERIODS_MS[status]
  if (ms == null || user.subscriptionStatusUpdatedAt == null) return false
  const updatedAt = DateTime.fromJSDate(user.subscriptionStatusUpdatedAt)
  return DateTime.now().toMillis() - updatedAt.toMillis() < ms
}

export function gracePeriodEndsAt(
  user: UserSubscriptionFields,
): DateTime | null {
  const status = user.subscriptionStatus
  if (status == null || !["incomplete", "past_due"].includes(status)) return null
  if (user.subscriptionStatusUpdatedAt == null) return null
  const ms = GRACE_PERIODS_MS[status as keyof typeof GRACE_PERIODS_MS]!
  return DateTime.fromJSDate(user.subscriptionStatusUpdatedAt).plus(ms)
}
