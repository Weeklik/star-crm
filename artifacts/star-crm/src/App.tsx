import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { OwnerControlsProvider } from "@/contexts/OwnerControlsContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { NavigationHistoryProvider } from "@/contexts/NavigationHistoryContext";

import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import Profile from "./pages/Profile";
import AddOrder from "./pages/AddOrder";

import SummarySalesReport from "./pages/SummarySalesReport";
import SalesBreakdown from "./pages/SalesBreakdown";
import Users from "./pages/Users";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";
import Planner from "./pages/Planner";
import Products from "./pages/Products";
import MyActivities from "./pages/MyActivities";
import Leads from "./pages/Leads";
import PerformaInvoice from "./pages/PerformaInvoice";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center gap-4">
      <img src="/logo.png" alt="Star Sewing Machines" className="w-16 h-16 object-contain animate-pulse" />
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
        <Route path="/orders/new">
          <ProtectedRoute component={AddOrder} />
        </Route>
        <Route path="/orders/:id/edit">
          <ProtectedRoute component={AddOrder} />
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
        <Route path="/products">
          <ProtectedRoute component={Products} ownerOnly />
        </Route>
        <Route path="/planner">
          <ProtectedRoute component={Planner} />
        </Route>
        <Route path="/activities">
          <ProtectedRoute component={MyActivities} />
        </Route>
        <Route path="/leads">
          <ProtectedRoute component={Leads} />
        </Route>
        <Route path="/performa-invoice">
          <ProtectedRoute component={PerformaInvoice} />
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
    <LanguageProvider>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <NavigationHistoryProvider>
                  <AppRoutes />
                </NavigationHistoryProvider>
              </AuthProvider>
            </QueryClientProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
