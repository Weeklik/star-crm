import { useUser, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, BarChart3, Users, LogOut, Loader2 } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: me, isLoading } = useGetMe();

  const handleSignOut = () => {
    signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/deals", label: "Deals", icon: Briefcase },
    { href: "/reports", label: "Reports", icon: BarChart3 },
  ];

  if (me?.role === "owner") {
    navItems.push({ href: "/users", label: "Users", icon: Users });
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-border">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="font-bold text-lg tracking-tight">Star CRM</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`nav-${item.label.toLowerCase()}`}>
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          {isLoading ? (
            <div className="flex items-center justify-center p-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="flex items-center gap-3 px-2 mb-4">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-primary/20 text-primary">{me?.name?.charAt(0) || user?.primaryEmailAddress?.emailAddress.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{me?.name || user?.primaryEmailAddress?.emailAddress}</p>
                <p className="text-xs text-muted-foreground capitalize">{me?.role}</p>
              </div>
            </div>
          )}
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleSignOut} data-testid="btn-signout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
