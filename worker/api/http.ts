import { zValidator } from "@hono/zod-validator"
import type { Context, ValidationTargets } from "hono"
import { HTTPException } from "hono/http-exception"
import type { z } from "zod"
import { logger } from "../logger"

export function validate<
  Schema extends z.ZodType,
  Target extends keyof ValidationTargets,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, result => {
    if (result.success) return
    const issue = result.error.issues[0]
    const path = issue?.path.join(".") ?? ""
    const message = issue?.message ?? "Invalid input"
    throw new HTTPException(400, {
      message: path === "" ? message : `${path}: ${message}`,
    })
  })
}

export function handleError(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  logger.error("Unhandled API error", { err, path: c.req.path })
  return c.json({ error: "Internal server error" }, 500)
}
