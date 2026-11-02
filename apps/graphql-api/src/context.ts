import type { YogaInitialContext } from "graphql-yoga"
import { getDb } from "database"
import type { Database, DbUser } from "database"
import { verifyJWT, extractBearerToken } from "auth"
import { eq } from "drizzle-orm"
import { users } from "database"
import { env } from "./env"
import { AuthenticationError } from "./errors"

export interface GraphQLContext {
  db: Database
  user: DbUser | null
  requireAuth: () => DbUser
}

export async function createContext(
  initialContext: YogaInitialContext,
): Promise<GraphQLContext> {
  const authHeader = initialContext.request.headers.get("authorization")
  const token = extractBearerToken(authHeader)

  const db = getDb()
  let user: DbUser | null = null

  if (token != null) {
    try {
      const payload = await verifyJWT(token, env.JWT_SECRET)
      if (payload.type === "access") {
        const userId = parseInt(payload.sub, 10)
        if (isNaN(userId)) throw new Error("Invalid token subject")
        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        user = found ?? null
      }
    } catch {
      // Invalid/expired token — treat as unauthenticated
    }
  }

  return {
    db,
    user,
    requireAuth() {
      if (user == null) throw new AuthenticationError()
      return user
    },
  }
}
