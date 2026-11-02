import { useQuery, useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { DateTime } from "luxon"
import ErrorState from "@/components/ErrorState"
import SettingsLayout from "@/components/SettingsLayout"

const BillingQuery = graphql(`
  query Billing {
    me {
      subscription {
        tier
        status
        jobLimit
        jobCount
        isActive
        gracePeriodEndsAt
      }
    }
    subscriptionPrices {
      monthly {
        id
        amount
      }
      yearly {
        id
        amount
      }
    }
  }
`)

const CreateCheckoutSessionMutation = graphql(`
  mutation CreateCheckoutSession($priceId: String!) {
    createCheckoutSession(input: { priceId: $priceId }) {
      url
    }
  }
`)

const CreateBillingPortalSessionMutation = graphql(`
  mutation CreateBillingPortalSession {
    createBillingPortalSession {
      url
    }
  }
`)

export default function BillingPage() {
  const [{ data, fetching, error }] = useQuery({ query: BillingQuery })
  const [, createCheckoutSession] = useMutation(CreateCheckoutSessionMutation)
  const [, createBillingPortalSession] = useMutation(
    CreateBillingPortalSessionMutation,
  )

  const subscription = data?.me?.subscription
  const prices = data?.subscriptionPrices

  async function subscribe(priceId: string) {
    const result = await createCheckoutSession({ priceId })
    const url = result.data?.createCheckoutSession.url
    if (url != null) window.location.href = url
  }

  async function manageSubscription() {
    const result = await createBillingPortalSession({})
    const url = result.data?.createBillingPortalSession.url
    if (url != null) window.location.href = url
  }

  return (
    <SettingsLayout>
      {error != null && data == null ? (
        <ErrorState title="Failed to load billing" message={error.message} />
      ) : fetching && data == null ? (
        <p className="text-zinc-500">Loading…</p>
      ) : subscription?.tier === "pro" ? (
        <div className="space-y-4">
          {subscription.status === "past_due" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              Your payment is past due. Pro access will be suspended on{" "}
              {subscription.gracePeriodEndsAt != null
                ? DateTime.fromISO(subscription.gracePeriodEndsAt).toLocaleString(DateTime.DATE_FULL)
                : "soon"}
              .{" "}
              <button
                onClick={manageSubscription}
                className="underline underline-offset-2"
              >
                Manage subscription →
              </button>
            </div>
          )}
          {subscription.status === "incomplete" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              Your subscription setup is incomplete. Pro access will expire on{" "}
              {subscription.gracePeriodEndsAt != null
                ? DateTime.fromISO(subscription.gracePeriodEndsAt).toLocaleString(DateTime.DATE_FULL)
                : "soon"}
              .
            </div>
          )}
          {subscription.status === "canceled" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
              Your subscription has been canceled. Pro access will be removed shortly.
            </div>
          )}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Current plan
              </p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
                Pro
              </p>
              {subscription.status != null && (
                <p className="mt-1 text-sm text-zinc-500 capitalize dark:text-zinc-400">
                  {subscription.status}
                </p>
              )}
            </div>
            <button
              onClick={manageSubscription}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Manage subscription
            </button>
          </div>
        </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Current plan
            </p>
            <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
              Free
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {subscription?.jobCount ?? 0} / {subscription?.jobLimit ?? 1} jobs
              used
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Monthly
              </p>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                ${((prices?.monthly.amount ?? 100) / 100).toFixed(0)}
                <span className="text-base font-normal text-zinc-500">/mo</span>
              </p>
              <ProPlanFeatures />
              <button
                onClick={() => subscribe(prices?.monthly.id ?? "")}
                disabled={prices == null}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                Subscribe
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500 p-6 dark:border-emerald-400">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Yearly
                </p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                  Save 17%
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                ${((prices?.yearly.amount ?? 1000) / 100).toFixed(0)}
                <span className="text-base font-normal text-zinc-500">/yr</span>
              </p>
              <ProPlanFeatures />
              <button
                onClick={() => subscribe(prices?.yearly.id ?? "")}
                disabled={prices == null}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  )
}

const ProPlanFeatures = () => (
  <ul className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 list-disc list-inside">
    <li>Unlimited cron jobs</li>
    <li>I'll fix bugs (if you find them)</li>
  </ul>
)
