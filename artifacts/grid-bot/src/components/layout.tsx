import { Link, useLocation } from "wouter";
import { Activity, Settings, Grid, LayoutDashboard, ScrollText } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/bots", label: "My Bots", icon: Grid },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 lg:w-64 border-r border-border bg-card flex-col shrink-0">
        <div className="p-4 lg:p-6 border-b border-border flex items-center gap-3">
          <Activity className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
          <h1 className="font-bold text-lg lg:text-xl tracking-tight">Bulk.trade</h1>
        </div>

        <nav className="flex-1 p-3 lg:p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">Grid Bot v1.0.0</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom Nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border flex items-stretch h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
