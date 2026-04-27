import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/lib/auth";
import { clearAppState, initCloudSync, syncFromCloud, ACTIVE_HOUSEHOLD_KEY } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

const NAV = [
  { to: "/", label: "Pulpit" },
  { to: "/wynagrodzenia", label: "Wynagrodzenia" },
  { to: "/wydatki", label: "Wydatki" },
  { to: "/aktywa", label: "Aktywa" },
  { to: "/kalkulatory", label: "Kalkulatory" },
  { to: "/settings", label: "Ustawienia" },
] as const;

export function AppShell() {
  const loc = useLocation();
  const router = useRouter();
  const { session, isAuthenticated, loading } = useAuthSession();
  const [signOutInProgress, setSignOutInProgress] = useState(false);

  useEffect(() => {
    if (session) {
      void initCloudSync(session);

      const onFocus = () => {
        console.log("Window focused, checking for cloud updates...");
        void syncFromCloud();
      };

      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, [session]);

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
    await router.navigate({ to: "/login" });
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

  if (!isAuthenticated && loc.pathname !== "/login") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-3xl font-display mb-4">Zaloguj się, aby kontynuować</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Twoje dane są bezpieczne — aby zobaczyć swój pulpit i gospodarstwo domowe, musisz zalogować się ponownie.
          </p>
          <Link
            to="/login"
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

          {isAuthenticated ? (
            <>
              <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
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
              <div className="text-xs text-muted-foreground shrink-0">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signOutInProgress}
                  className="hover:text-foreground"
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

      <Outlet />

      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          Wartości orientacyjne. Stawki ZUS/PIT na 2025. Dane lokalne i synchronizacja cloud
          (Supabase).
        </div>
      </footer>
    </div>
  );
}
