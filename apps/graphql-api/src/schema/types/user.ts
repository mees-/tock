import { builder } from "../builder"
import type { DbUser } from "database"

export const UserRef = builder.objectRef<DbUser>("User").implement({
  fields: t => ({
    id: t.exposeInt("id", { nullable: false }),
    username: t.exposeString("username", { nullable: false }),
    role: t.exposeString("role", { nullable: false }),
    createdAt: t.field({
      type: "String",
      nullable: false,
      resolve: u => u.createdAt.toISOString(),
    }),
  }),
})

export const AuthPayloadRef = builder
  .objectRef<{ token: string; refreshToken: string; user: DbUser }>("AuthPayload")
  .implement({
    fields: t => ({
      token: t.exposeString("token", { nullable: false }),
      refreshToken: t.exposeString("refreshToken", { nullable: false }),
      user: t.field({
        type: UserRef,
        nullable: false,
        resolve: p => p.user,
      }),
    }),
  })
