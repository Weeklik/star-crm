import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Deals from "./pages/Deals";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ component: Component, ownerOnly = false }: { component: React.ComponentType; ownerOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
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
  if (isLoading) return null;
  return <Redirect to={user ? "/dashboard" : "/sign-in"} />;
}

function SignInPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to="/dashboard" />;
  return <Login />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/deals">
        <ProtectedRoute component={Deals} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} ownerOnly />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
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
  );
}

export default App;
