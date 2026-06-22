import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, BarChart3, Users, LogOut, Loader2,
  ChevronDown, TableProperties, TrendingUp, Sun, Moon, PieChart, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const isReportsActive =
    location === "/reports" || location.startsWith("/reports/");

  const [reportsOpen, setReportsOpen] = useState(isReportsActive);

  const topItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/deals", label: "Orders", icon: Briefcase },
    { href: "/planner", label: "Planner", icon: CalendarDays },
  ];

  const reportsChildren = [
    ...(user?.role === "owner"
      ? [{ href: "/reports/dashboard", label: "Reports Dashboard", icon: PieChart }]
      : []),
    { href: "/reports/summary-sales", label: "Monthly Report", icon: TableProperties },
    { href: "/reports/sales-breakdown", label: "Summary Report", icon: TrendingUp },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="h-20 flex items-center px-4 border-b border-border">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Star Sewing Machines" className="w-10 h-10 object-contain flex-shrink-0" />
              <span className="font-bold text-xs leading-tight tracking-tight">STAR SEWING MACHINES TRADING L.L.C</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-4 space-y-1">
            {topItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            {/* Reports collapsible */}
            <div>
              <button
                onClick={() => setReportsOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-colors ${isReportsActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                data-testid="nav-reports"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5" />
                  Reports
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${reportsOpen ? "rotate-180" : ""}`} />
              </button>

              {reportsOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-border pl-3">
                  {reportsChildren.map((child) => {
                    const Icon = child.icon;
                    const isActive = location === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {user?.role === "owner" && (
              <Link
                href="/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === "/users" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                data-testid="nav-users"
              >
                <Users className="w-5 h-5" />
                Users
              </Link>
            )}

          </nav>
        </div>

        {/* Bottom section: theme + user + sign out */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Theme toggle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">Appearance</p>
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  theme === "light"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  theme === "dark"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          {/* User info — clicking navigates to /profile */}
          {isLoading ? (
            <div className="flex items-center justify-center p-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Link href="/profile" className="flex items-center gap-3 px-2 rounded-md hover:bg-secondary transition-colors py-1 cursor-pointer">
              <Avatar className="h-9 w-9 shrink-0">
                {user?.profilePicture && <AvatarImage src={user.profilePicture} alt={user.name ?? "Avatar"} />}
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user?.name?.charAt(0) ?? user?.email?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </Link>
          )}

          {/* Sign out */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={logout}
            data-testid="btn-signout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
