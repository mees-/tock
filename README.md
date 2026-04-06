# tock

An open-source cronjob-as-HTTP-requests scheduler.

Schedule HTTP requests (webhooks, API calls, etc.) using cron expressions — with
a GraphQL API, clean UI, and full run history.

## Architecture

| Service             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `apps/graphql-api`  | Hono + graphql-yoga + Pothos GraphQL API            |
| `apps/cron-runner`  | Standalone cron scheduler (reads DB, executes jobs) |
| `apps/web`          | React + Vite + urql + gql-tada frontend             |
| `packages/database` | Drizzle ORM schema + Postgres client (source-only)  |
| `packages/auth`     | JWT sign/verify + password hashing (source-only)    |

## Quick start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [pnpm](https://pnpm.io) ≥ 9
- [Docker](https://docker.com) (for Postgres)

### 1. Clone & install

```bash
git clone https://github.com/yourorg/tock.git
cd tock
pnpm install
```

### 2. Start Postgres

```bash
docker-compose up -d
```

### 3. Start all services

```bash
pnpm dev
```

- GraphQL API + GraphiQL: `http://localhost:4000/graphql`
- Web UI: `http://localhost:5173`

On first startup, visit `http://localhost:5173/setup` to create the admin
account.

> **Note:** The repo ships with `COMMUNITY_EDITION=true` in all `.env.local`
> files, so Stripe is disabled and no additional setup is needed.

---

## Developing with Stripe

To test billing locally, you'll need a [Stripe](https://stripe.com) account and
the [Stripe CLI](https://stripe.com/docs/stripe-cli).

Rather than editing the committed `.env.local` files, use a gitignored `.envrc`
at the repo root via [direnv](https://direnv.net):

```bash
# .envrc (never committed — add your own values)
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

Bun won't overwrite environment variables that are already set in the shell, so
these values take precedence over the defaults in `.env.local` automatically —
no file editing needed.

To forward Stripe events to your local webhook handler:

```bash
stripe listen --forward-to localhost:4001/webhook
```
