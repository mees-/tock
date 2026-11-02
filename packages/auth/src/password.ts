import { argon2idAsync } from "@noble/hashes/argon2.js"

// Workers' WebCrypto rejects PBKDF2 above 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_SALT_BYTES = 16
const PBKDF2_KEY_BITS = 256
const PBKDF2_PREFIX = "$pbkdf2-sha256$"
const ARGON2ID_PREFIX = "$argon2id$"

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

async function pbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    PBKDF2_KEY_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_PREFIX}i=${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

async function verifyPbkdf2(password: string, encoded: string) {
  const [params, salt, hash] = encoded.slice(PBKDF2_PREFIX.length).split("$")
  const iterations = Number(params?.replace("i=", ""))
  if (salt == null || hash == null || !Number.isInteger(iterations)) {
    return false
  }
  const expected = fromBase64(hash)
  const actual = await pbkdf2(password, fromBase64(salt), iterations)
  return timingSafeEqual(actual, expected)
}

// Legacy hashes from Bun.password.hash: $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>
async function verifyArgon2id(password: string, encoded: string) {
  const [, , version, params, salt, hash] = encoded.split("$")
  if (version == null || params == null || salt == null || hash == null) {
    return false
  }
  const options = Object.fromEntries(
    params.split(",").map(pair => {
      const [name, value] = pair.split("=")
      return [name, Number(value)]
    }),
  )
  const expected = fromBase64(hash)
  const actual = await argon2idAsync(password, fromBase64(salt), {
    m: options.m!,
    t: options.t!,
    p: options.p!,
    version: Number(version.replace("v=", "")),
    dkLen: expected.length,
  })
  return timingSafeEqual(actual, expected)
}

export async function verifyPassword(password: string, encoded: string) {
  if (encoded.startsWith(PBKDF2_PREFIX)) return verifyPbkdf2(password, encoded)
  if (encoded.startsWith(ARGON2ID_PREFIX)) {
    return verifyArgon2id(password, encoded)
  }
  return false
}

export function passwordNeedsRehash(encoded: string) {
  return !encoded.startsWith(`${PBKDF2_PREFIX}i=${PBKDF2_ITERATIONS}$`)
}
