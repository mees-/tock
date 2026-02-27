import {
  Clock,
  Globe,
  Box,
  Sliders,
  ArrowRight,
  Check,
  X,
  Github,
} from "lucide-react"
import { Link, useLocation } from "wouter"
import StatusBadge from "@/components/StatusBadge"
import { useEffect } from "react"
import { useCanSignup } from "@/lib/auth/canSignupHook"
import { DateTime } from "luxon"
import { useMediaQuery } from "usehooks-ts"

const GITHUB_URL = "https://github.com/mees-/tock"

const FAKE_RUNS = [
  {
    id: 1,
    triggeredAt: DateTime.fromISO("2026-02-26T09:00:00Z"),
    status: "success" as const,
    http: 200,
    duration: "312ms",
  },
  {
    id: 2,
    triggeredAt: DateTime.fromISO("2026-02-25T09:00:00Z"),
    status: "failure" as const,
    http: 503,
    duration: "89ms",
  },
  {
    id: 3,
    triggeredAt: DateTime.fromISO("2026-02-24T09:00:00Z"),
    status: "timeout" as const,
    http: null,
    duration: "30000ms",
  },
  {
    id: 4,
    triggeredAt: DateTime.fromISO("2026-02-23T09:00:00Z"),
    status: "success" as const,
    http: 200,
    duration: "278ms",
  },
]

export default function MarketingPage() {
  const canSignup = useCanSignup()
  const [, navigate] = useLocation()
  const isMobile = useMediaQuery("(max-width: 768px)")
  useEffect(() => {
    if (!canSignup) {
      navigate("/login")
    }
  }, [canSignup, navigate])
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Clock size={20} className="text-emerald-400" />
            <span className="text-lg font-bold tracking-tight text-white">
              tock
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <Github size={15} />
              GitHub
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Open
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 pt-16 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-950/60 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            HTTP-native cron scheduler
          </div>

          {/* H1 */}
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
            Cron jobs that{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              actually work.
            </span>
          </h1>

          {/* Sub-copy */}
          <p className="mb-10 text-lg leading-relaxed text-zinc-400 md:text-xl">
            Tock fires HTTP requests on a schedule. Self-hosted, observable,
            zero-daemon.
          </p>

          {/* CTAs */}
          <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Get started
              <ArrowRight size={16} />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              <Github size={16} />
              View on GitHub
            </a>
          </div>

          {/* Terminal snippet */}
          <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs text-zinc-500">
                tock — job config
              </span>
            </div>
            <div className="px-5 py-4 font-mono text-sm leading-relaxed">
              <p>
                <span className="text-zinc-500">method: </span>
                <span className="text-emerald-400">GET</span>
              </p>
              <p>
                <span className="text-zinc-500">endpoint: </span>
                <span className="text-blue-400">
                  https://api.example.com/run-report
                </span>
              </p>
              <p>
                <span className="text-zinc-500">schedule: </span>
                <span className="text-white">0 9 * * *</span>
                <span className="text-zinc-600"> # every day at 9am</span>
              </p>
              <p className="mt-3 flex items-center gap-2 text-zinc-400">
                <span className="text-emerald-400">✓</span>
                <span>
                  Last run <span className="text-white">200 OK</span> in{" "}
                  <span className="text-white">312ms</span>
                </span>
                <span className="animate-pulse text-zinc-600">▌</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why HTTP cron? */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
              Why HTTP cron?
            </h2>
            <p className="mt-3 text-zinc-500">
              Traditional cron is a host concern. Tock makes it a service
              concern.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Globe size={22} className="text-emerald-600" />}
              title="Portable"
              body="Write your jobs in any language, host them anywhere. If it's reachable over HTTP, Tock can schedule it."
            />
            <FeatureCard
              icon={<Box size={22} className="text-emerald-600" />}
              title="Docker-native"
              body="Don't install cron inside your containers! Tock lives outside your containers and calls them."
            />
            <FeatureCard
              icon={<Sliders size={22} className="text-emerald-600" />}
              title="Configurable"
              body="Set custom headers, request bodies, auth tokens, and timeouts per job. Not possible with classic cron."
            />
          </div>
        </div>
      </section>

      {/* Ditch Cloudflare Cron */}
      <section className="bg-zinc-50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Left */}
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">
                Platform-free
              </p>
              <h2 className="mb-5 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
                Ditch Cloudflare Cron.
              </h2>
              <p className="mb-5 text-zinc-600 leading-relaxed">
                Cloudflare's cron triggers look convenient — until you realize
                they only call Cloudflare Workers. Your schedule, your logic,
                your data: all locked into their platform.
              </p>
              <p className="text-zinc-600 leading-relaxed">
                Tock runs on your infrastructure and fires requests at{" "}
                <em>any</em> URL — your own API, a webhook, a third-party
                service. You own the scheduler and the target.
              </p>
            </div>

            {/* Right — comparison table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 sm:px-5 sm:py-3.5" />
                    <th className="w-16 px-3 py-3 text-center font-semibold text-zinc-900 sm:w-auto sm:px-5 sm:py-3.5">
                      Tock
                    </th>
                    <th className="w-16 px-3 py-3 text-center font-medium text-zinc-400 sm:w-auto sm:px-5 sm:py-3.5">
                      <span className="">
                        {isMobile ? "Cloudflare" : "Cloudflare Cron"}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[
                    "Self-hosted",
                    "Any HTTP endpoint",
                    "Full response logs",
                    "Open source",
                  ].map(feature => (
                    <tr key={feature}>
                      <td className="px-4 py-3 text-zinc-700 sm:px-5 sm:py-3.5">
                        {feature}
                      </td>
                      <td className="px-3 py-3 text-center sm:px-5 sm:py-3.5">
                        <Check size={16} className="mx-auto text-emerald-600" />
                      </td>
                      <td className="px-3 py-3 text-center sm:px-5 sm:py-3.5">
                        <X size={16} className="mx-auto text-zinc-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Observability */}
      <section className="bg-zinc-950 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Know when something breaks — and why.
            </h2>
            <p className="text-lg text-zinc-400">
              Every run is logged with status, duration, response body, and
              headers. No more blind cron failures.
            </p>
          </div>

          {/* Fake runs table */}
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Triggered at
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    HTTP
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {FAKE_RUNS.map(run => (
                  <tr key={run.id} className="bg-zinc-950">
                    <td className="px-4 py-3 text-zinc-300">
                      {isMobile
                        ? run.triggeredAt.toLocaleString(DateTime.DATE_SHORT)
                        : run.triggeredAt.toLocaleString(DateTime.DATETIME_MED)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      {run.http != null ? (
                        <span
                          className={
                            run.http < 400
                              ? "font-mono text-emerald-400"
                              : "font-mono text-red-400"
                          }
                        >
                          {run.http}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                      {run.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-20 text-center">
        <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
          Ready to replace your cron?
        </h2>
        <p className="mb-8 text-emerald-100">
          Self-host in minutes. No cloud accounts, no vendor lock-in.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-emerald-700 shadow-lg transition-colors hover:bg-emerald-50"
        >
          Get started free
          <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-emerald-600" />
            <span>tock — open source cron scheduler</span>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-zinc-700"
          >
            <Github size={14} />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-7 shadow-sm">
      <div className="mb-4 inline-flex rounded-lg bg-emerald-50 p-2.5">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="text-zinc-500 leading-relaxed">{body}</p>
    </div>
  )
}
