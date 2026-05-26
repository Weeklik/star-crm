import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { OwnerControlsProvider } from "@/contexts/OwnerControlsContext";
import { Star } from "lucide-react";

import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import Profile from "./pages/Profile";

import SummarySalesReport from "./pages/SummarySalesReport";
import SalesBreakdown from "./pages/SalesBreakdown";
import ReportsDashboard from "./pages/ReportsDashboard";
import Users from "./pages/Users";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import Planner from "./pages/Planner";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center gap-4">
      <Star className="w-10 h-10 text-amber-400 animate-pulse" />
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ component: Component, ownerOnly = false }: { component: React.ComponentType; ownerOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  if (ownerOnly && user.role !== "owner") return <Redirect to="/dashboard" />;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  return <Redirect to={user ? "/dashboard" : "/sign-in"} />;
}

function SignInPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (user) return <Redirect to="/dashboard" />;
  return <Login />;
}

function AppRoutes() {
  return (
    <CurrencyProvider>
    <OwnerControlsProvider>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/deals">
          <ProtectedRoute component={Deals} />
        </Route>
        <Route path="/reports/dashboard">
          <ProtectedRoute component={ReportsDashboard} ownerOnly />
        </Route>
        <Route path="/reports/summary-sales">
          <ProtectedRoute component={SummarySalesReport} />
        </Route>
        <Route path="/reports/sales-breakdown">
          <ProtectedRoute component={SalesBreakdown} />
        </Route>
        <Route path="/users">
          <ProtectedRoute component={Users} ownerOnly />
        </Route>
        <Route path="/planner">
          <ProtectedRoute component={Planner} />
        </Route>
        <Route path="/profile">
          <ProtectedRoute component={Profile} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </OwnerControlsProvider>
    </CurrencyProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
