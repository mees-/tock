import { lazy, Suspense } from "react"
import { Switch, Route, Redirect } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import Layout from "@/components/Layout"
import LoginPage from "@/pages/LoginPage"
import SetupPage from "@/pages/SetupPage"
import MarketingPage from "@/pages/MarketingPage"
import DashboardPageSkeleton from "@/components/skeletons/DashboardPageSkeleton"
import JobDetailPageSkeleton from "@/components/skeletons/JobDetailPageSkeleton"

const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const NewJobPage = lazy(() => import("@/pages/NewJobPage"))
const JobDetailPage = lazy(() => import("@/pages/JobDetailPage"))
const UserSettingsPage = lazy(() => import("@/pages/settings/UserSettingsPage"))
const SettingsBillingPage = lazy(() => import("@/pages/settings/BillingPage"))

function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (token == null) return <Redirect to="/login" />
  return <>{children}</>
}

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/setup" component={SetupPage} />

      <Route path="/">
        <MarketingPage />
      </Route>

      <Route>
        <AuthGate>
          <Layout>
            <Switch>
              <Route path="/dashboard">
                <Suspense fallback={<DashboardPageSkeleton />}>
                  <DashboardPage />
                </Suspense>
              </Route>

              <Route path="/jobs/new">
                <Suspense fallback={<DashboardPageSkeleton />}>
                  <NewJobPage />
                </Suspense>
              </Route>

              <Route path="/jobs/:id">
                <Suspense fallback={<JobDetailPageSkeleton />}>
                  <JobDetailPage />
                </Suspense>
              </Route>

              <Route path="/settings/user">
                <Suspense fallback={<DashboardPageSkeleton />}>
                  <UserSettingsPage />
                </Suspense>
              </Route>

              <Route path="/settings/billing">
                <Suspense fallback={<DashboardPageSkeleton />}>
                  <SettingsBillingPage />
                </Suspense>
              </Route>

              <Route path="/settings">
                <Redirect to="/settings/user" />
              </Route>
            </Switch>
          </Layout>
        </AuthGate>
      </Route>
    </Switch>
  )
}
