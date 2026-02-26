import { Switch, Route, Redirect } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import { useQuery } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import Layout from "@/components/Layout"
import LoginPage from "@/pages/LoginPage"
import SetupPage from "@/pages/SetupPage"
import DashboardPage from "@/pages/DashboardPage"
import NewJobPage from "@/pages/NewJobPage"
import JobDetailPage from "@/pages/JobDetailPage"

function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (token == null) return <Redirect to="/login" />
  return <>{children}</>
}

export default function App() {
  const token = useAuthStore(s => s.token)

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/setup" component={SetupPage} />

      <Route>
        <AuthGate>
          <Layout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/jobs/new" component={NewJobPage} />
              <Route path="/jobs/:id" component={JobDetailPage} />
              <Route>
                <Redirect to="/" />
              </Route>
            </Switch>
          </Layout>
        </AuthGate>
      </Route>
    </Switch>
  )
}

function RedirectToLogin() {
  return <Redirect to="/login" />
}
