import { db, users } from "database"
import { count } from "drizzle-orm"
import { createServer } from "./server"
import { logger } from "./logger"
import { env } from "./env"

async function main() {
  const server = createServer().start()

  // Check if this is the first startup (no users exist)
  const count = await db.$count(users)
  if (count === 0) {
    logger.info(
      { port: env.PORT },
      `No users found. Open the app to create your first user`,
    )
  }
}

main().catch(err => {
  logger.error(err, "Failed to start server")
  process.exit(1)
})
