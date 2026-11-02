import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { DateTime } from "luxon"
import { z } from "zod"
import { extractBearerToken, signJWT, verifyJWT } from "../auth/jwt"
import type { JWTPayload } from "../auth/jwt"
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../auth/password"
import { getDb } from "../db/client"
import { users } from "../db/schema"
import type { DbUser } from "../db/schema"
import { env } from "../env"
import { validate } from "./http"

const ACCESS_TOKEN_TTL = { minutes: 15 }
const REFRESH_TOKEN_TTL = { days: 7 }

export const passwordSchema = z.string().min(8)

const credentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
})

const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: passwordSchema,
})

export type AuthEnv = { Variables: { user: DbUser } }

export function unauthenticated(message = "Authentication required") {
  return new HTTPException(401, { message })
}

async function userFromToken(token: string, type: JWTPayload["type"]) {
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET)
    if (payload.type !== type) return null
    const userId = parseInt(payload.sub, 10)
    if (isNaN(userId)) return null
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user ?? null
  } catch {
    return null
  }
}

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const token = extractBearerToken(c.req.header("authorization"))
  const user = token == null ? null : await userFromToken(token, "access")
  if (user == null) throw unauthenticated()
  c.set("user", user)
  await next()
})

export async function canSignup() {
  if (!env.COMMUNITY_EDITION) return true
  // Community edition only lets the first user (the admin) sign up.
  return (await getDb().$count(users)) === 0
}

async function authPayload(user: DbUser) {
  const claims = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
  }
  const [token, refreshToken] = await Promise.all([
    signJWT(
      { ...claims, type: "access" },
      env.JWT_SECRET,
      DateTime.now().plus(ACCESS_TOKEN_TTL).toUnixInteger(),
    ),
    signJWT(
      { ...claims, type: "refresh" },
      env.JWT_SECRET,
      DateTime.now().plus(REFRESH_TOKEN_TTL).toUnixInteger(),
    ),
  ])
  return {
    token,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  }
}

export const auth = new Hono()
  .post("/login", validate("json", credentialsSchema), async c => {
    const { username, password } = c.req.valid("json")
    const db = getDb()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (user == null || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthenticated("Invalid credentials")
    }

    if (passwordNeedsRehash(user.passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(users.id, user.id))
    }

    return c.json(await authPayload(user))
  })
  .post("/register", validate("json", signupSchema), async c => {
    if (!(await canSignup())) {
      throw new HTTPException(403, { message: "Registration is disabled" })
    }

    const { username, password } = c.req.valid("json")
    const db = getDb()
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    if (existing != null) {
      throw new HTTPException(409, { message: "Username already taken" })
    }

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash: await hashPassword(password),
        role: "member",
      })
      .returning()
    if (user == null) throw new Error("Insert returned no user")

    return c.json(await authPayload(user), 201)
  })
  .post(
    "/refresh",
    validate("json", z.object({ refreshToken: z.string() })),
    async c => {
      const user = await userFromToken(
        c.req.valid("json").refreshToken,
        "refresh",
      )
      if (user == null)
        throw unauthenticated("Invalid or expired refresh token")
      return c.json(await authPayload(user))
    },
  )
