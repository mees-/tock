import { Switch, Route, Redirect } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import Layout from "@/components/Layout"
import LoginPage from "@/pages/LoginPage"
import SetupPage from "@/pages/SetupPage"
import DashboardPage from "@/pages/DashboardPage"
import NewJobPage from "@/pages/NewJobPage"
import JobDetailPage from "@/pages/JobDetailPage"
import MarketingPage from "@/pages/MarketingPage"
import { useCanSignup } from "./lib/auth/canSignupHook"

function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (token == null) return <Redirect to="/login" />
  return <>{children}</>
}

export default function App() {
  const token = useAuthStore(s => s.token)
  const canSignup = useCanSignup()

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/setup" component={SetupPage} />

      <Route path="/" component={MarketingPage} />

      <Route>
        <AuthGate>
          <Layout>
            <Switch>
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/jobs/new" component={NewJobPage} />
              <Route path="/jobs/:id" component={JobDetailPage} />
            </Switch>
          </Layout>
        </AuthGate>
      </Route>
    </Switch>
  )
}
