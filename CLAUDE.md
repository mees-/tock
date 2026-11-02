# tock — agent instructions

tock is an open-source cronjob-as-HTTP-requests scheduler.

## Structure

```
apps/
  graphql-api/   # Cloudflare Worker: GraphQL API (Pothos + Drizzle), Stripe
                 # webhook, minute Cron Trigger scheduler, serves web/dist
  web/           # React + Vite frontend (urql + gql-tada)
packages/
  database/      # Drizzle schema + D1 client (source-only, not built)
  auth/          # JWT sign/verify + password hashing (source-only)
```

Everything deploys as one Worker (`apps/graphql-api/wrangler.jsonc`) with a D1
binding `DB`. There is no background process: a `* * * * *` Cron Trigger calls
`runDueJobs` in `apps/graphql-api/src/scheduler.ts`. Cron expressions must have
5 fields.

## Commands

```bash
pnpm dev                                       # Local D1 + wrangler dev + vite + cron helper
pnpm typecheck                                 # Typecheck all apps/packages
pnpm setup-db                                  # Create local D1 and push schema
pnpm --filter database push-dev               # Push schema changes to local D1
pnpm --filter database studio                 # Open Drizzle Studio (local D1)
pnpm run deploy                                # Build web and deploy the Worker
```

## Code guidelines

- Never use `process.env` directly. Use an `env.ts` file per app/package (parse
  with Zod). Worker code reads bindings via
  `import { env } from "cloudflare:workers"` inside `env.ts`.
- Worker code runs on workerd, not Bun: no `Bun.*` APIs in
  `apps/graphql-api/src` or `packages/*/src`. Bun is only used for dev scripts.
- Prefer explicit null checks (`if (x == null)`) over boolean coercion
  (`if (!x)`).
- Avoid classes; prefer functions.
- Avoid type annotations when they can be inferred.

## Packages

Packages in `packages/*` are **never built**. They are included directly as
TypeScript source and bundled by wrangler, and type-checked via tsconfig
`paths`.

## GraphQL schema changes

When modifying the GraphQL schema (Pothos types/mutations/queries), regenerate:

```bash
pnpm --filter graphql-api generate-schema   # Writes apps/graphql-api/schema.graphql
cd apps/web && pnpm gql-tada              # Updates src/lib/graphql/graphql-env.d.ts
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
file under `apps/graphql-api/.wrangler/`; `drizzle.config.ts` points at it.
`drizzle.remote.config.ts` targets the production D1 over HTTP (`migrate`).

**Never generate drizzle migrations directly.** Always use:

```bash
pnpm --filter database push-dev
```

This pushes schema changes directly to the local development database.

## Auth

- Username + password auth, passwords hashed with PBKDF2-SHA256 via WebCrypto
  (`packages/auth/src/password.ts`). Legacy argon2id hashes are verified and
  rehashed on login.
- Short-lived access tokens (15 min) via JWT (`jose`).
- Refresh tokens (7 days) stored in httpOnly cookies.
- Auth REST endpoints at `/api/auth/*` on the graphql-api server.
- GraphQL requests authenticated via `Authorization: Bearer <token>` header.
