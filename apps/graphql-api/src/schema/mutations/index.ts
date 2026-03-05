import { builder } from "../builder"
import { JobRef } from "../types/job"
import { AuthPayloadRef } from "../types/user"
import { jobs, users, type HttpMethod, type DbUser } from "database"
import { eq, and, sql, count } from "drizzle-orm"
import { signJWT, verifyJWT } from "auth"
import { env } from "../../env"
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  ForbiddenError,
} from "../../errors"
import { z } from "zod"
import { canSignup } from "../queries"
import { GraphQLError } from "graphql/error"
import { DateTime } from "luxon"
import { stripe } from "../../stripe"

const SIGNUP_SCHEMA = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8),
})

async function buildAuthPayload(user: DbUser) {
  const base = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
  } as const

  const [token, refreshToken] = await Promise.all([
    signJWT(
      { ...base, type: "access" },
      env.JWT_SECRET,
      DateTime.now().plus({ minutes: 15 }).toUnixInteger(),
    ),
    signJWT(
      { ...base, type: "refresh" },
      env.JWT_SECRET,
      DateTime.now().plus({ days: 7 }).toUnixInteger(),
    ),
  ])

  return { token, refreshToken, user }
}

// ─── Auth mutations ───────────────────────────────────────────────────────────

builder.mutationField("login", t =>
  t.fieldWithInput({
    type: AuthPayloadRef,
    nullable: false,
    input: {
      username: t.input.string({ required: true }),
      password: t.input.string({ required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1)

      if (user == null) throw new AuthenticationError("Invalid credentials")

      const valid = await Bun.password.verify(input.password, user.passwordHash)
      if (!valid) throw new AuthenticationError("Invalid credentials")

      return buildAuthPayload(user)
    },
  }),
)

builder.mutationField("refreshToken", t =>
  t.fieldWithInput({
    type: AuthPayloadRef,
    nullable: false,
    input: { token: t.input.string({ required: true }) },
    resolve: async (_root, { input }, ctx) => {
      try {
        const payload = await verifyJWT(input.token, env.JWT_SECRET)
        if (payload.type !== "refresh")
          throw new GraphQLError("Invalid token type")
        const [user] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(payload.sub)))
          .limit(1)
        if (user == null) throw new AuthenticationError("Invalid token")
        return await buildAuthPayload(user)
      } catch {
        throw new AuthenticationError("Invalid or expired refresh token")
      }
    },
  }),
)

builder.mutationField("register", t =>
  t.fieldWithInput({
    type: AuthPayloadRef,
    nullable: false,
    input: {
      username: t.input.string({ required: true }),
      password: t.input.string({ required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      if (!(await canSignup(ctx.db))) {
        throw new ValidationError("Registration is disabled")
      }

      const parsed = SIGNUP_SCHEMA.safeParse(input)
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues[0]?.message ?? "Invalid input",
        )
      }

      const existing = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1)

      if (existing[0] != null)
        throw new ValidationError("Username already taken")

      const passwordHash = await Bun.password.hash(input.password)

      const [user] = await ctx.db
        .insert(users)
        .values({ username: input.username, passwordHash, role: "member" })
        .returning()

      if (user == null) throw new ValidationError("Failed to create user")
      return buildAuthPayload(user)
    },
  }),
)

builder.mutationField("changePassword", t =>
  t.fieldWithInput({
    type: "Boolean",
    nullable: false,
    input: {
      currentPassword: t.input.string({ required: true }),
      newPassword: t.input.string({ required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      const auth = ctx.requireAuth()

      const parsed = SIGNUP_SCHEMA.shape.password.safeParse(input.newPassword)
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues[0]?.message ?? "Invalid password",
        )
      }

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, auth.id))
        .limit(1)

      if (user == null) throw new AuthenticationError("User not found")

      const valid = await Bun.password.verify(
        input.currentPassword,
        user.passwordHash,
      )
      if (!valid) throw new AuthenticationError("Incorrect current password")

      const passwordHash = await Bun.password.hash(input.newPassword)
      await ctx.db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, auth.id))

      return true
    },
  }),
)

// ─── Job mutations ────────────────────────────────────────────────────────────

type MutationFieldBuilder = Parameters<
  Parameters<typeof builder.mutationField>[1]
>[0]

const jobInputFields = (t: MutationFieldBuilder) => ({
  name: t.input.string({ required: true }),
  description: t.input.string({ required: false }),
  endpoint: t.input.string({ required: true }),
  method: t.input.string({ required: true }),
  headers: t.input.string({ required: false }),
  body: t.input.string({ required: false }),
  cronExpression: t.input.string({ required: true }),
})

function parseHeaders(raw: string | null | undefined): Record<string, string> {
  if (raw == null) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    throw new ValidationError("Invalid JSON in headers")
  }
}

builder.mutationField("createJob", t =>
  t.fieldWithInput({
    type: JobRef,
    nullable: false,
    input: jobInputFields(t),
    resolve: async (_root, { input }, ctx) => {
      const user = ctx.requireAuth()

      if (user.subscriptionTier === "free") {
        const [{ value: jobCount }] = await ctx.db
          .select({ value: count() })
          .from(jobs)
          .where(eq(jobs.userId, user.id))
        if (jobCount >= 1) {
          throw new ForbiddenError(
            "Job limit reached. Upgrade to Pro for unlimited jobs.",
          )
        }
      }

      const [job] = await ctx.db
        .insert(jobs)
        .values({
          userId: user.id,
          name: input.name,
          description: input.description ?? "",
          endpoint: input.endpoint,
          method: input.method as HttpMethod,
          headers: parseHeaders(input.headers),
          body: input.body ?? null,
          cronExpression: input.cronExpression,
        })
        .returning()

      if (job == null) throw new ValidationError("Failed to create job")
      return job
    },
  }),
)

builder.mutationField("updateJob", t =>
  t.fieldWithInput({
    type: JobRef,
    nullable: false,
    input: {
      id: t.input.int({ required: true }),
      name: t.input.string({ required: false }),
      description: t.input.string({ required: false }),
      endpoint: t.input.string({ required: false }),
      method: t.input.string({ required: false }),
      headers: t.input.string({ required: false }),
      body: t.input.string({ required: false }),
      cronExpression: t.input.string({ required: false }),
      timezone: t.input.string({ required: false }),
    },
    resolve: async (_root, { input }, ctx) => {
      const user = ctx.requireAuth()

      const updates: Partial<typeof jobs.$inferInsert> = {}
      if (input.name != null) updates.name = input.name
      if (input.description != null) updates.description = input.description
      if (input.endpoint != null) updates.endpoint = input.endpoint
      if (input.method != null) updates.method = input.method as HttpMethod
      if (input.headers != null) updates.headers = parseHeaders(input.headers)
      if (input.body !== undefined) updates.body = input.body
      if (input.cronExpression != null)
        updates.cronExpression = input.cronExpression

      const [job] = await ctx.db
        .update(jobs)
        .set(updates)
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, user.id)))
        .returning()

      if (job == null) throw new NotFoundError("Job")
      return job
    },
  }),
)

builder.mutationField("deleteJob", t =>
  t.boolean({
    nullable: false,
    args: { id: t.arg.int({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const user = ctx.requireAuth()

      const result = await ctx.db
        .delete(jobs)
        .where(and(eq(jobs.id, args.id), eq(jobs.userId, user.id)))
        .returning({ id: jobs.id })

      if (result.length === 0) throw new NotFoundError("Job")
      return true
    },
  }),
)

builder.mutationField("toggleJob", t =>
  t.field({
    type: JobRef,
    nullable: false,
    args: { id: t.arg.int({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const user = ctx.requireAuth()

      const [job] = await ctx.db
        .update(jobs)
        .set({ isActive: sql`NOT ${jobs.isActive}` })
        .where(and(eq(jobs.id, args.id), eq(jobs.userId, user.id)))
        .returning()

      if (job == null) throw new NotFoundError("Job")
      return job
    },
  }),
)

// ─── Stripe mutations ─────────────────────────────────────────────────────────

const KNOWN_PRICE_IDS = () =>
  new Set([env.STRIPE_PRO_MONTHLY_PRICE_ID, env.STRIPE_PRO_YEARLY_PRICE_ID])

const CheckoutSessionRef = builder
  .objectRef<{ url: string }>("CheckoutSession")
  .implement({ fields: t => ({ url: t.exposeString("url") }) })

const BillingPortalSessionRef = builder
  .objectRef<{ url: string }>("BillingPortalSession")
  .implement({ fields: t => ({ url: t.exposeString("url") }) })

builder.mutationField("createCheckoutSession", t =>
  t.fieldWithInput({
    type: CheckoutSessionRef,
    nullable: false,
    input: { priceId: t.input.string({ required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const user = ctx.requireAuth()

      if (!KNOWN_PRICE_IDS().has(input.priceId)) {
        throw new ValidationError("Invalid price ID")
      }

      let customerId = user.stripeCustomerId
      if (customerId == null) {
        const customer = await stripe.customers.create({
          metadata: { userId: String(user.id) },
        })
        customerId = customer.id
        await ctx.db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, user.id))
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        client_reference_id: String(user.id),
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: `${env.WEB_URL}/settings/billing?success=true`,
        cancel_url: `${env.WEB_URL}/settings/billing`,
      })

      if (session.url == null)
        throw new ValidationError("Failed to create checkout session")
      return { url: session.url }
    },
  }),
)

builder.mutationField("createBillingPortalSession", t =>
  t.field({
    type: BillingPortalSessionRef,
    nullable: false,
    resolve: async (_root, _args, ctx) => {
      const user = ctx.requireAuth()

      if (user.stripeCustomerId == null) {
        throw new ValidationError("No billing account found")
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${env.WEB_URL}/settings/billing`,
      })

      return { url: session.url }
    },
  }),
)
