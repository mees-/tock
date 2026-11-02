# tock — agent instructions

tock is an open-source cronjob-as-HTTP-requests scheduler.

## Structure

One package (no workspace), built with Vite and the Cloudflare Vite plugin:

```
src/        # React frontend (TanStack Query), served as static assets
worker/     # Cloudflare Worker: REST API, Stripe webhook, minute Cron
            # Trigger scheduler
  api/      # Hono routes mounted at /api (zod-validated)
  db/       # Drizzle schema + D1 client
  auth/     # JWT sign/verify + password hashing
scripts/    # Dev tooling run by Bun/Vite, not deployed
```

Everything deploys as one Worker (`wrangler.jsonc`) with a D1 binding `DB`.
There is no background process: a `* * * * *` Cron Trigger calls `runDueJobs` in
`worker/scheduler.ts`. Cron expressions must have 5 fields.

## Commands

```bash
pnpm dev               # Local D1 + vite (web, Worker, cron) on :5173
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

## API

- Routes live in `worker/api/*.ts` as chained Hono apps
  (`new Hono().get(...) .post(...)`); chaining is what lets `hc<Api>` in
  `src/lib/api.ts` infer request and response types. No codegen.
- Validate input with `validate(target, schema)` from `worker/api/http.ts`.
- Signal errors by throwing `HTTPException`; `handleError` turns it into
  `{ error: message }` with that status. Return only success bodies via
  `c.json`, so the client's inferred types stay success-only.
- Authenticated routes use the `requireUser` middleware (`c.var.user`).
- Frontend: call `unwrap(api.<path>.$<method>(...))` inside TanStack Query
  `useQuery`/mutations; it throws `Error(message)` on non-2xx. A 401 triggers
  one refresh-token retry in `authFetch`.
- `tsconfig.worker.json` is a composite project that emits declarations; the app
  project references it to import the `Api` type.

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
- Refresh tokens (7 days) kept in the zustand `tock-auth` store, exchanged at
  `POST /api/auth/refresh`.
- API requests authenticated via `Authorization: Bearer <token>` header.
