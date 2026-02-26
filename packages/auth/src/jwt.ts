import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from "jose"

export interface JWTPayload extends JoseJWTPayload {
  sub: string
  username: string
  role: "admin" | "member"
  type: "access" | "refresh"
}

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret)
}

function isValidPayload(payload: unknown): payload is JWTPayload {
  if (typeof payload !== "object" || payload == null) return false
  const p = payload as Record<string, unknown>
  return (
    typeof p.sub === "string" &&
    typeof p.username === "string" &&
    (p.role === "admin" || p.role === "member") &&
    (p.type === "access" || p.type === "refresh")
  )
}

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodeSecret(secret))
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, encodeSecret(secret))
  if (!isValidPayload(payload)) throw new Error("Invalid JWT payload")
  return payload
}

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (authHeader == null) return null
  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer") return null
  return parts[1] ?? null
}
