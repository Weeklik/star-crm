import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, BarChart3, Users, LogOut, Loader2,
  ChevronDown, TableProperties, TrendingUp, Sun, Moon, CalendarDays, Package, MapPin,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { LANGUAGE_CONFIGS, type Language } from "@/i18n/translations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  const isReportsActive =
    location === "/reports" || location.startsWith("/reports/");

  const [reportsOpen, setReportsOpen] = useState(isReportsActive);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const topItems = [
    { href: "/dashboard",  label: t("nav.dashboard"),   icon: LayoutDashboard },
    { href: "/deals",      label: t("nav.orders"),      icon: Briefcase },
    { href: "/planner",    label: t("nav.planner"),     icon: CalendarDays },
    { href: "/activities", label: "My Activities",      icon: MapPin },
  ];

  const reportsChildren = [
    { href: "/reports/summary-sales",   label: t("nav.monthlyReport"),  icon: TableProperties },
    { href: "/reports/sales-breakdown", label: t("nav.summaryReport"),  icon: TrendingUp },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className={`flex-shrink-0 border-r border-border bg-card flex flex-col justify-between overflow-hidden transition-all duration-200 ${sidebarOpen ? "w-64" : "w-0 border-r-0"}`}>
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
                  data-testid={`nav-${item.href.slice(1)}`}
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
                  {t("nav.reports")}
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
                {t("nav.users")}
              </Link>
            )}
            {user?.role === "owner" && (
              <Link
                href="/products"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === "/products" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                data-testid="nav-products"
              >
                <Package className="w-5 h-5" />
                Products
              </Link>
            )}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Language toggle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">{t("nav.language")}</p>
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
              {LANGUAGE_CONFIGS.map((cfg) => (
                <button
                  key={cfg.code}
                  onClick={() => setLanguage(cfg.code as Language)}
                  title={cfg.name}
                  className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    language === cfg.code
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cfg.nativeName}
                </button>
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">{t("nav.appearance")}</p>
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
                {t("nav.light")}
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
                {t("nav.dark")}
              </button>
            </div>
          </div>

          {/* User info */}
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
            {t("nav.signOut")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        {/* Sidebar toggle strip */}
        <div className="flex items-center px-3 py-2 border-b border-border/40 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen
              ? <PanelLeftClose className="w-5 h-5" />
              : <PanelLeftOpen className="w-5 h-5" />
            }
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
