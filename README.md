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

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to a random 32+ char string
```

### 3. Start Postgres

```bash
docker-compose up -d
```

### 4. Push database schema

```bash
pnpm db:push
```

### 5. Generate GraphQL types

```bash
pnpm generate-schema
cd apps/web && pnpm gql-tada
```

### 6. Start all services

```bash
pnpm dev
```

- GraphQL API: `http://localhost:4000/graphql`
- GraphiQL: `http://localhost:4000/graphql` (in development)
- Web UI: `http://localhost:5173`

On first startup, visit `http://localhost:5173/setup` to create the admin
account.

---

## Scripts

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `pnpm dev`             | Start all services concurrently         |
| `pnpm build`           | Build all packages and apps             |
| `pnpm typecheck`       | Typecheck all workspaces                |
| `pnpm db:push`         | Push schema changes to Postgres         |
| `pnpm db:studio`       | Open Drizzle Studio                     |
| `pnpm generate-schema` | Regenerate `schema.graphql` from Pothos |

## Environment variables

| Variable                | Default    | Description                                       |
| ----------------------- | ---------- | ------------------------------------------------- |
| `DATABASE_URL`          | —          | **Required.** Postgres connection URL             |
| `JWT_SECRET`            | —          | **Required.** Secret for signing JWTs (32+ chars) |
| `ALLOW_SIGNUP`          | `false`    | Allow open registration                           |
| `PORT`                  | `4000`     | GraphQL API port                                  |
| `VITE_GRAPHQL_ENDPOINT` | `/graphql` | GraphQL endpoint for the web app                  |
| `SYNC_INTERVAL_MS`      | `30000`    | Cron runner DB sync interval                      |
