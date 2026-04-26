import { Link, Outlet, useLocation } from "@tanstack/react-router";

const NAV = [
  { to: "/", label: "Pulpit" },
  { to: "/wynagrodzenia", label: "Wynagrodzenia" },
  { to: "/wydatki", label: "Wydatki" },
  { to: "/aktywa", label: "Aktywa" },
] as const;

export function AppShell() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[image:var(--gradient-accent)] flex items-center justify-center text-accent-foreground font-display font-bold text-lg shadow-[var(--shadow-card)]">
              ₧
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-lg leading-tight">Płaca.netto</p>
              <p className="text-xs text-muted-foreground leading-tight">
                Bud&#380;et gospodarstwa &middot; PL 2025
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {NAV.map((n) => {
              const active =
                n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          Wartości orientacyjne. Stawki ZUS/PIT na 2025. Dane zapisywane lokalnie w przeglądarce.
        </div>
      </footer>
    </div>
  );
}
