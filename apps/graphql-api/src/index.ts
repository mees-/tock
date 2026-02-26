import { db, users } from "database"
import { count } from "drizzle-orm"
import { createServer } from "./server"
import { logger } from "./logger"
import { env } from "./env"

async function main() {
  // Check if this is the first startup (no users exist)
  const [row] = await db.select({ cnt: count() }).from(users)
  if ((row?.cnt ?? 0) === 0) {
    logger.info(
      { port: env.PORT },
      `No users found. Visit http://localhost:${env.PORT}/setup to create the first admin account.`,
    )
  }

  const server = createServer()
  server.start()
}

main().catch(err => {
  logger.error(err, "Failed to start server")
  process.exit(1)
})
