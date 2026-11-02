# tock

An open-source cronjob-as-HTTP-requests scheduler.

Schedule HTTP requests (webhooks, API calls, etc.) using cron expressions — with
a REST API, clean UI, and full run history.

## Architecture

Everything runs as a single Cloudflare Worker backed by D1, built with Vite and
the Cloudflare Vite plugin.

| Path          | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `src/`        | React + TanStack Query frontend, served as the Worker's static assets        |
| `worker/`     | The Worker: REST API, Stripe webhook, minute Cron Trigger                    |
| `worker/api/` | Hono routes under `/api`; the frontend calls them through Hono's `hc` client |
| `worker/db/`  | Drizzle ORM schema + D1 client                                               |
| `scripts/`    | Dev tooling (local Cron Trigger)                                             |

A Cron Trigger fires every minute and runs every active job whose cron
expression matches that minute. Cron expressions use 5 fields (no seconds). The
hosted edition keeps successful runs for 30 days and failed runs for 90 days;
community edition installs keep full history.

## Quick start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (dev scripts)
- [pnpm](https://pnpm.io) ≥ 9
- Node.js ≥ 22.5 (drizzle-kit uses `node:sqlite` for the local D1 database)

### 1. Clone & install

```bash
git clone https://github.com/yourorg/tock.git
cd tock
pnpm install
```

### 2. Start everything

```bash
pnpm dev
```

This creates the local D1 database, pushes the schema, and starts Vite at
`http://localhost:5173`, which serves the web UI, the Worker (`/api/*`) and
fires the scheduled handler every minute.

On first startup, visit `http://localhost:5173/setup` to create the admin
account.

> **Note:** The repo ships with `COMMUNITY_EDITION=true` in `.env` (local Worker
> variables), so Stripe is disabled and no additional setup is needed.

---

## Developing with Stripe

To test billing locally, you'll need a [Stripe](https://stripe.com) account and
the [Stripe CLI](https://stripe.com/docs/stripe-cli).

Put your Stripe test values in a gitignored `.env.local` at the repo root; it
overrides `.env`:

```bash
COMMUNITY_EDITION=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

To forward Stripe events to the local Worker:

```bash
stripe listen --forward-to localhost:5173/stripe/webhook
```

---

## Deploying to Cloudflare

The Worker, its D1 database (`tock`, EU jurisdiction) and secrets live in
Cloudflare. Deploy with:

```bash
pnpm run deploy
```

This typechecks, builds the web app and Worker with Vite, and deploys them with
the minute Cron Trigger. Secrets are managed with
`pnpm exec wrangler secret put <NAME>`.

Schema changes to production D1 are not applied by `deploy`. Apply them with
`wrangler d1 execute DB --remote` or `pnpm db:migrate-remote` (needs
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and a D1-scoped
`CLOUDFLARE_API_TOKEN`).
