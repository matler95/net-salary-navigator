import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  RefreshCw,
  LayoutDashboard,
  Banknote,
  ShoppingBag,
  PieChart,
  Calculator,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { useAuthSession } from "@/lib/auth";
import {
  clearAppState,
  getCachedHouseholdName,
  initCloudSync,
  syncFromCloud,
  ACTIVE_HOUSEHOLD_KEY,
  PENDING_INVITE_TOKEN_KEY,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

const NAV = [
  { to: "/", label: "Przegląd", icon: LayoutDashboard },
  { to: "/wynagrodzenia", label: "Zarobki", icon: Banknote },
  { to: "/wydatki", label: "Wydatki", icon: ShoppingBag },
  { to: "/aktywa", label: "Majątek", icon: PieChart },
  { to: "/kalkulatory", label: "Kalkulatory", icon: Calculator },
  { to: "/settings", label: "Ustawienia", icon: Settings },
] as const;

const SIDEBAR_COLLAPSED_KEY = "saldeo:sidebar-collapsed";

export function AppShell() {
  const loc = useLocation();
  const router = useRouter();
  const { session, isAuthenticated, loading } = useAuthSession();
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (!session) return;

    const hasPendingInvite =
      typeof window !== "undefined" &&
      (Boolean(window.localStorage.getItem(PENDING_INVITE_TOKEN_KEY)) ||
        new URLSearchParams(window.location.search).has("invite"));
    if (
      hasPendingInvite &&
      (loc.pathname.startsWith("/login") || loc.pathname.startsWith("/invite"))
    ) {
      console.log("Pending invite detected, delaying cloud sync until invite acceptance.");
      return;
    }

    void initCloudSync(session);
    setHouseholdName(getCachedHouseholdName());

    const onFocus = () => {
      void syncFromCloud();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFromCloud();
      }
    };

    const onMetaChange = () => {
      setHouseholdName(getCachedHouseholdName());
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("household:meta-change", onMetaChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("household:meta-change", onMetaChange);
    };
  }, [session, loc.pathname]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await syncFromCloud();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    if (signOutInProgress) return;
    setSignOutInProgress(true);
    const supabase = await getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearAppState();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
    }
    await router.navigate({ to: "/login", search: { invite: undefined, register: undefined } });
    setSignOutInProgress(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-warm)]">
          <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-accent animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Ładowanie Saldeo…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated && loc.pathname !== "/login" && loc.pathname !== "/invite") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-warm)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-accent-foreground font-display font-bold text-xl shadow-[var(--shadow-warm)]">
              S
            </div>
            <span className="font-display text-xl italic text-accent">Saldeo</span>
          </div>
          <h1 className="text-3xl font-display mb-4">Zaloguj się, aby kontynuować</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Twoje dane są bezpieczne — aby zobaczyć swój przegląd finansów i gospodarstwo domowe, musisz zalogować się ponownie.
          </p>
          <Link
            to="/login"
            search={{ invite: undefined, register: undefined }}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90 shadow-[var(--shadow-warm)]"
          >
            Przejdź do logowania
          </Link>
        </div>
      </main>
    );
  }

  const isLoginPage = loc.pathname === "/login" || loc.pathname === "/invite";

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-background">
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop Sidebar ── */}
      {isAuthenticated && (
        <aside
          className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-30 bg-card border-r border-border shadow-[var(--shadow-warm)] transition-all duration-300 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Logo */}
          <div className={`flex items-center gap-3 px-4 py-5 border-b border-border shrink-0 ${collapsed ? "justify-center" : ""}`}>
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-accent-foreground font-display font-bold text-xl shadow-[var(--shadow-warm)]">
                S
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="font-display text-lg italic leading-tight text-accent truncate">Saldeo</p>
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">
                    {householdName ?? "Twoje finanse"}
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={collapsed ? n.label : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group ${
                    active
                      ? "bg-accent text-accent-foreground shadow-[var(--shadow-warm)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent-soft/60"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon className={`shrink-0 ${active ? "w-5 h-5" : "w-5 h-5"}`} />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom area: user + refresh + logout */}
          <div className="px-2 pb-4 border-t border-border pt-3 space-y-1 shrink-0">
            {isAuthenticated && (
              <>
                {/* User info */}
                {!collapsed && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground" title={session?.user.email}>
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0 border border-accent/20">
                      {(session?.user.user_metadata?.nickname || session?.user.email || "?")[0].toUpperCase()}
                    </div>
                    <span className="truncate font-medium">
                      {session?.user.user_metadata?.nickname?.trim() ||
                        session?.user.email?.split("@")[0] ||
                        ""}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                  title="Odśwież dane"
                  aria-label="Odśwież dane"
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${collapsed ? "justify-center" : ""}`}
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
                  {!collapsed && <span>Odśwież</span>}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signOutInProgress}
                  title="Wyloguj"
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors ${collapsed ? "justify-center" : ""}`}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{signOutInProgress ? "Wylogowywanie…" : "Wyloguj"}</span>}
                </button>
              </>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
            className="absolute -right-3 top-[4.5rem] w-6 h-6 rounded-full bg-card border border-border shadow-[var(--shadow-warm)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent-soft transition-colors z-10"
          >
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </aside>
      )}

      {/* ── Main content ── */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isAuthenticated ? (collapsed ? "md:ml-16" : "md:ml-60") : ""
        }`}
      >
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>

        <footer className="border-t border-border pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-display italic text-accent">Saldeo</span>
            <span>·</span>
            <span>Wartości orientacyjne. Stawki ZUS/PIT na 2025.</span>
          </div>
        </footer>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] flex items-end justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 flex-1 min-w-0 px-1 py-1.5 rounded-xl transition-all duration-200 active:scale-90 ${
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`rounded-lg p-1 transition-all ${active ? "bg-accent/10" : ""}`}>
                  <Icon className={`w-5 h-5 ${active ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-tight truncate w-full text-center leading-tight">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
