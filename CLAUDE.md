# tock — agent instructions

tock is an open-source cronjob-as-HTTP-requests scheduler.

## Structure

One package (no workspace), built with Vite and the Cloudflare Vite plugin:

```
src/        # React frontend (urql + gql-tada), served as static assets
worker/     # Cloudflare Worker: GraphQL API (Pothos + Drizzle), Stripe
            # webhook, minute Cron Trigger scheduler
  db/       # Drizzle schema + D1 client
  auth/     # JWT sign/verify + password hashing
scripts/    # Dev tooling run by Bun/Vite, not deployed
```

Everything deploys as one Worker (`wrangler.jsonc`) with a D1 binding `DB`.
There is no background process: a `* * * * *` Cron Trigger calls `runDueJobs` in
`worker/scheduler.ts`. Cron expressions must have 5 fields.

## Commands

```bash
pnpm dev               # Local D1 + schema watcher + vite (web, Worker, cron) on :5173
pnpm typecheck         # tsc -b over app, worker and tooling projects
pnpm setup-db          # Create local D1 and push schema
pnpm db:push           # Push schema changes to local D1
pnpm db:studio         # Open Drizzle Studio (local D1)
pnpm run deploy        # Build and deploy the Worker (`pnpm deploy` is a pnpm builtin)
```

## Code guidelines

- Never use `process.env` directly. Parse env with Zod in an `env.ts`. Worker
  code reads bindings via `import { env } from "cloudflare:workers"` inside
  `worker/env.ts`; use `import.meta.env.DEV` for dev-only behavior.
- Worker code runs on workerd, not Bun: no `Bun.*` APIs in `worker/`. Bun is
  only used for scripts.
- Prefer explicit null checks (`if (x == null)`) over boolean coercion
  (`if (!x)`).
- Avoid classes; prefer functions.
- Avoid type annotations when they can be inferred.

## GraphQL schema changes

When modifying the GraphQL schema (Pothos types/mutations/queries), regenerate:

```bash
pnpm generate-schema   # Writes schema.graphql (pnpm dev does this on change)
pnpm gql-tada          # Updates src/lib/graphql/graphql-env.d.ts
```

Both steps are required — skipping the second causes type errors in the web app.

### Pothos nullability

`@pothos/core` fields are **nullable by default** unless
`defaultFieldNullability: false` is set on the builder (it is). Always verify
nullable fields use `nullable: true` explicitly:

```ts
responseBody: t.exposeString('responseBody', { nullable: true }),
```

## Database

Uses Drizzle ORM with Cloudflare D1 (SQLite). Local dev uses the Miniflare D1
file under `.wrangler/`; `drizzle.config.ts` points at it.
`drizzle.remote.config.ts` targets the production D1 over HTTP.

**Never generate drizzle migrations directly.** Always use:

```bash
pnpm db:push
```

This pushes schema changes directly to the local development database.

## Auth

- Username + password auth, passwords hashed with PBKDF2-SHA256 via WebCrypto
  (`worker/auth/password.ts`). Legacy argon2id hashes are verified and rehashed
  on login.
- Short-lived access tokens (15 min) via JWT (`jose`).
- Refresh tokens (7 days) stored in httpOnly cookies.
- GraphQL requests authenticated via `Authorization: Bearer <token>` header.
