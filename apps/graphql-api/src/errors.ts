import { GraphQLError } from "graphql"

export class AuthenticationError extends GraphQLError {
  constructor(message = "Authentication required") {
    super(message, { extensions: { code: "UNAUTHENTICATED" } })
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = "Forbidden") {
    super(message, { extensions: { code: "FORBIDDEN" } })
  }
}

export class NotFoundError extends GraphQLError {
  constructor(resource: string) {
    super(`${resource} not found`, { extensions: { code: "NOT_FOUND" } })
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: "BAD_USER_INPUT" } })
  }
}
