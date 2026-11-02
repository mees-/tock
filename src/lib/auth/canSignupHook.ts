import { useQuery } from "urql"
import { graphql } from "../graphql/graphql"

const CanSignupQuery = graphql(`
  query CanSignup {
    canSignup
  }
`)

export const useCanSignup = () => {
  const [{ data: canSignupData }] = useQuery({ query: CanSignupQuery })
  const canSignup = canSignupData?.canSignup ?? true

  return canSignup
}
