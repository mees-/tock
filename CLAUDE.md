# tock — agent instructions

tock is an open-source cronjob-as-HTTP-requests scheduler.

## Structure

```
apps/
  graphql-api/   # GraphQL API (Pothos + Drizzle), runs with Bun
  cron-runner/   # Standalone cron scheduler, runs with Bun
  web/           # React + Vite frontend (urql + gql-tada)
packages/
  database/      # Drizzle schema + Postgres client (source-only, not built)
  auth/          # JWT sign/verify + password hashing (source-only)
```

## Commands

```bash
pnpm dev                                       # Start all services concurrently
pnpm typecheck                                 # Typecheck all apps/packages
docker-compose up -d                           # Start local Postgres
pnpm db:push                                   # Push schema changes to DB
pnpm db:studio                                 # Open Drizzle Studio
pnpm generate-schema                           # Regenerate schema.graphql + gql-tada types
```

## Code guidelines

- Never use `process.env` directly. Use an `env.ts` file per app/package (parse
  with Zod).
- Prefer explicit null checks (`if (x == null)`) over boolean coercion
  (`if (!x)`).
- Avoid classes; prefer functions.
- Avoid type annotations when they can be inferred.

## Packages

Packages in `packages/*` are **never built**. They are included directly as
TypeScript source at runtime by Bun, and for type-checking via tsconfig `paths`.

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

Uses Drizzle ORM with `postgres.js` for PostgreSQL.

**Never generate drizzle migrations directly.** Always use:

```bash
pnpm --filter database db:dev-push
```

This pushes schema changes directly to the local development database.

## Auth

- Username + password auth, passwords hashed with `Bun.password.hash()`
  (bcrypt).
- Short-lived access tokens (15 min) via JWT (`jose`).
- Refresh tokens (7 days) stored in httpOnly cookies.
- Auth REST endpoints at `/api/auth/*` on the graphql-api server.
- GraphQL requests authenticated via `Authorization: Bearer <token>` header.
