# tock

An open-source cronjob-as-HTTP-requests scheduler.

Schedule HTTP requests (webhooks, API calls, etc.) using cron expressions — with
a GraphQL API, clean UI, and full run history.

## Architecture

Everything runs as a single Cloudflare Worker backed by D1.

| Path                | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| `apps/graphql-api`  | The Worker: GraphQL API, Stripe webhook, minute Cron Trigger, serves the web build |
| `apps/web`          | React + Vite + urql + gql-tada frontend (static assets)                            |
| `packages/database` | Drizzle ORM schema + D1 client (source-only)                                       |
| `packages/auth`     | JWT sign/verify + password hashing (source-only)                                   |

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

This creates the local D1 database, pushes the schema, and starts:

- Worker (GraphQL API + GraphiQL): `http://localhost:4000/graphql`
- Web UI: `http://localhost:5173`
- A helper that fires the scheduled handler every minute (`wrangler dev` does
  not run Cron Triggers on its own)

On first startup, visit `http://localhost:5173/setup` to create the admin
account.

> **Note:** The repo ships with `COMMUNITY_EDITION=true` in
> `apps/graphql-api/.env.local`, so Stripe is disabled and no additional setup
> is needed.

---

## Developing with Stripe

To test billing locally, you'll need a [Stripe](https://stripe.com) account and
the [Stripe CLI](https://stripe.com/docs/stripe-cli).

Rather than editing the committed `.env.local` files, use a gitignored `.envrc`
at the repo root via [direnv](https://direnv.net):

```bash
# .envrc (never committed — add your own values)
export CLOUDFLARE_INCLUDE_PROCESS_ENV=true
export COMMUNITY_EDITION=false
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_PRO_MONTHLY_PRICE_ID=price_...
export STRIPE_PRO_YEARLY_PRICE_ID=price_...
export STRIPE_WEBHOOK_SECRET=whsec_...
```

```bash
# Allow direnv to load it
direnv allow
```

`CLOUDFLARE_INCLUDE_PROCESS_ENV` makes `wrangler dev` pass shell variables to
the Worker, and they take precedence over `.env.local`.

To forward Stripe events to the local Worker:

```bash
stripe listen --forward-to localhost:4000/stripe/webhook
```

---

## Deploying to Cloudflare

The Worker, its D1 database (`tock`, EU jurisdiction) and secrets live in
Cloudflare. Deploy from the repo root:

```bash
pnpm run deploy
```

This builds the web app and deploys the Worker with its static assets and the
minute Cron Trigger. Secrets are managed with
`pnpm -F graphql-api exec wrangler secret put <NAME>`.

Schema changes to production D1 are not applied by `deploy`. Apply them with
`wrangler d1 execute DB --remote` or `pnpm -F database migrate` (needs
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and a D1-scoped
`CLOUDFLARE_API_TOKEN`).
