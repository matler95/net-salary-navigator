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
  User 
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
  { to: "/", label: "Pulpit", icon: LayoutDashboard },
  { to: "/wynagrodzenia", label: "Wynagrodzenia", icon: Banknote },
  { to: "/wydatki", label: "Wydatki", icon: ShoppingBag },
  { to: "/aktywa", label: "Aktywa", icon: PieChart },
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
    await router.navigate({ to: "/login", search: { invite: undefined } });
    setSignOutInProgress(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Ładowanie sesji użytkownika…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated && loc.pathname !== "/login" && loc.pathname !== "/invite") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-3xl font-display mb-4">Zaloguj się, aby kontynuować</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Twoje dane są bezpieczne — aby zobaczyć swój pulpit i gospodarstwo domowe, musisz zalogować się ponownie.
          </p>
          <Link
            to="/login"
            search={{ invite: undefined }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Przejdź do logowania
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-(image:--gradient-accent) flex items-center justify-center text-accent-foreground font-display font-bold text-lg shadow-(--shadow-card)">
              ₧
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-lg leading-tight">Płaca.netto</p>
              <p className="text-xs text-muted-foreground leading-tight">
                {householdName ?? "Płaca.netto"} · PL 2025
              </p>
            </div>
          </Link>

          {isAuthenticated ? (
            <>
              <nav className="hidden md:flex items-center gap-1">
                {NAV.map((n) => {
                  const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
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
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                {isAuthenticated && (
                  <div className="flex items-center gap-2" title={session?.user.email}>
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0 border border-accent/20">
                      {(session?.user.user_metadata?.nickname || session?.user.email || "?")[0].toUpperCase()}
                    </div>
                    <span className="hidden md:block truncate max-w-30 font-medium">
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
                  className="hover:text-foreground transition-colors p-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signOutInProgress}
                  className="hover:text-foreground p-1.5"
                >
                  {signOutInProgress ? "Wylogowywanie…" : "Wyloguj"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground shrink-0">
              <Link to="/login" search={{ invite: undefined }} className="hover:text-foreground">
                Zaloguj
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        <Outlet />
      </main>

      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border px-1 pt-2 pb-[calc(env(safe-area-inset-bottom)+6px)] flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 flex-1 min-w-0 px-1 py-1 rounded-xl transition-all duration-200 active:scale-90 ${
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                <span className="text-[8px] font-bold uppercase tracking-tighter truncate w-full text-center">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <footer className="border-t border-border mt-12 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          Wartości orientacyjne. Stawki ZUS/PIT na 2025. Dane lokalne i synchronizacja cloud
          (Supabase).
        </div>
      </footer>
    </div>
  );
}
