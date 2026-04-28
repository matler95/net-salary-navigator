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
  User,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LogOut,
  Menu
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

export function AppShell() {
  const loc = useLocation();
  const router = useRouter();
  const { session, isAuthenticated, loading } = useAuthSession();
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("saldeo_sidebar_collapsed") === "true";
    }
    return false;
  });

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

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("saldeo_sidebar_collapsed", String(newState));
    }
  };

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
        <div className="rounded-2xl border border-border bg-card p-6 text-center animate-in fade-in zoom-in duration-300">
          <p className="text-sm text-muted-foreground">Ładowanie sesji użytkownika…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated && loc.pathname !== "/login" && loc.pathname !== "/invite") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-8 shadow-warm animate-in slide-in-from-bottom-4 duration-500">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gradient-accent)] flex items-center justify-center text-accent-foreground mb-6 shadow-md">
            <Leaf className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-display italic font-semibold mb-4 tracking-tight">Zaloguj się, aby kontynuować</h1>
          <p className="mb-8 text-muted-foreground leading-relaxed">
            Twoje finanse są bezpieczne. Aby zobaczyć swój pulpit i zarządzać budżetem, zaloguj się do swojego konta.
          </p>
          <Link
            to="/login"
            search={{ invite: undefined, register: undefined }}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            Przejdź do logowania
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      {isAuthenticated && (
        <aside 
          className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? "w-20" : "w-64"
          } shrink-0 sticky top-0 h-screen z-30`}
        >
          <div className="p-6 flex items-center justify-between overflow-hidden">
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--gradient-accent)] flex items-center justify-center text-accent-foreground shadow-md shrink-0">
                <Leaf className="w-5 h-5" />
              </div>
              {!sidebarCollapsed && (
                <span className="font-display italic font-semibold text-xl tracking-tight animate-in fade-in slide-in-from-left-2 duration-300">
                  Saldeo
                </span>
              )}
            </Link>
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              aria-label={sidebarCollapsed ? "Rozwiń pasek" : "Zwiń pasek"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    active 
                      ? "bg-accent text-accent-foreground shadow-md" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm truncate animate-in fade-in duration-300">
                      {n.label}
                    </span>
                  )}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {n.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border space-y-1">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-accent-soft/30 mb-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0 border border-accent/20">
                {(session?.user.user_metadata?.nickname || session?.user.email || "?")[0].toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 animate-in fade-in duration-300">
                  <p className="text-xs font-semibold truncate leading-none mb-1">
                    {session?.user.user_metadata?.nickname?.trim() || session?.user.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-none">
                    {householdName ?? "Gospodarstwo"}
                  </p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Odśwież dane"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
              {!sidebarCollapsed && <span className="text-xs font-medium">Odśwież dane</span>}
            </button>

            <button
              onClick={handleLogout}
              disabled={signOutInProgress}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 transition-all ${sidebarCollapsed ? "justify-center" : ""}`}
              title="Wyloguj"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="text-xs font-medium">{signOutInProgress ? "Wychodzę…" : "Wyloguj"}</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Header */}
      <header className="md:hidden border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--gradient-accent)] flex items-center justify-center text-accent-foreground shadow-sm">
              <Leaf className="w-4 h-4" />
            </div>
            <span className="font-display italic font-semibold text-lg tracking-tight">Saldeo</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent border border-accent/20">
              {(session?.user.user_metadata?.nickname || session?.user.email || "?")[0].toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
        
        <footer className="border-t border-border mt-auto">
          <div className="max-w-7xl mx-auto px-6 py-8 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-4 items-center">
            <p>© 2025 Saldeo · Twoje finanse, po ludzku.</p>
            <div className="flex items-center gap-4">
              <span>Stawki ZUS/PIT 2025</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Cloud Sync</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Nav */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+8px)] flex items-center justify-around shadow-[0_-8px_24px_rgba(0,0,0,0.05)]">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1.5 flex-1 min-w-0 py-1 rounded-2xl transition-all duration-200 active:scale-90 ${
                  active
                    ? "text-accent"
                    : "text-muted-foreground"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? "bg-accent/10" : ""}`}>
                  <Icon className={`w-6 h-6 ${active ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight truncate w-full text-center ${active ? "text-accent" : "text-muted-foreground"}`}>
                  {n.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

