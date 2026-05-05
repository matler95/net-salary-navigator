import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  LayoutDashboard,
  Banknote,
  ShoppingBag,
  TrendingUp,
  Calculator,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  House,
} from "lucide-react";
import { useAuthSession } from "@/lib/auth";
import {
  clearAppState,
  getCachedHouseholdName,
  initCloudSync,
  syncFromCloud,
  actions,
  ACTIVE_HOUSEHOLD_KEY,
  PENDING_INVITE_TOKEN_KEY,
} from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Przegląd", icon: LayoutDashboard },
  { to: "/wynagrodzenia", label: "Zarobki", icon: Banknote },
  { to: "/wydatki", label: "Wydatki", icon: ShoppingBag },
  { to: "/aktywa", label: "Majątek", icon: TrendingUp },
  { to: "/kalkulatory", label: "Kalkulatory", icon: Calculator },
  { to: "/settings", label: "Ustawienia", icon: Settings },
] as const;

const SIDEBAR_KEY = "saldeo-sidebar-collapsed";

function SaldeoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-accent font-display font-bold italic text-accent-foreground shadow-[var(--shadow-warm)]"
    >
      S
    </div>
  );
}

/** Skeleton loading screen with branded pulse */
function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent font-display text-3xl font-bold italic text-accent-foreground shadow-[var(--shadow-warm)] animate-pulse-gentle">
          S
        </div>
        <p className="text-sm text-muted-foreground animate-pulse-gentle">Ładowanie…</p>
      </div>
    </main>
  );
}

/** Full-page not-authenticated splash */
function NotAuthenticatedScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-10 shadow-[var(--shadow-elevated)] animate-fade-up">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent font-display text-2xl font-bold italic text-accent-foreground shadow-[var(--shadow-warm)]">
            S
          </div>
          <div>
            <p className="font-display text-xl font-bold">Saldeo</p>
            <p className="text-xs text-muted-foreground">Twoje finanse, po ludzku.</p>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Zaloguj się, aby kontynuować</h1>
        <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
          Twoje dane są bezpieczne. Aby zobaczyć swój przegląd i gospodarstwo domowe, zaloguj się
          ponownie.
        </p>
        <Link
          to="/login"
          search={{ invite: undefined, register: undefined }}
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] shadow-[var(--shadow-warm)]"
        >
          Przejdź do logowania
        </Link>
      </div>
    </main>
  );
}

export function AppShell() {
  const loc = useLocation();
  const router = useRouter();
  const { session, isAuthenticated, loading } = useAuthSession();
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) return saved === "true";
    return false; // Default to expanded for SSR safety
  });

  // Persist collapse state
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    }
  }, [collapsed]);

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
      return;
    }

    void initCloudSync(session);
    void actions.fetchRetirementLimits();
    setHouseholdName(getCachedHouseholdName());

    const onFocus = () => void syncFromCloud();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncFromCloud();
    };
    const onMetaChange = () => setHouseholdName(getCachedHouseholdName());

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("household:meta-change", onMetaChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onVisibilityChange);
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
    if (supabase) await supabase.auth.signOut();
    clearAppState();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
    }
    await router.navigate({ to: "/login", search: { invite: undefined, register: undefined } });
    setSignOutInProgress(false);
  };

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated && loc.pathname !== "/login" && loc.pathname !== "/invite") {
    return <NotAuthenticatedScreen />;
  }

  // Auth pages - render without shell
  if (loc.pathname === "/login" || loc.pathname === "/invite") {
    return <Outlet />;
  }

  const nickname =
    session?.user.user_metadata?.nickname?.trim() || session?.user.email?.split("@")[0] || "Ty";
  const avatarLetter = nickname[0]?.toUpperCase() ?? "?";

  const mobileNav = [
    { to: "/", label: "Dom", icon: LayoutDashboard },
    { to: "/wynagrodzenia", label: "Zarobki", icon: Banknote },
    { to: "/wydatki", label: "Wydatki", icon: ShoppingBag },
    { to: "/aktywa", label: "Majątek", icon: TrendingUp },
    { to: "/settings", label: "Więcej", icon: Menu, isMore: true },
  ];

  const moreNavItems = [
    { to: "/kalkulatory", label: "Kalkulatory", icon: Calculator },
    { to: "/settings", label: "Ustawienia", icon: Settings },
  ];

  return (
    <div
      className="flex min-h-screen flex-col md:flex-row bg-background"
      data-sidebar-collapsed={collapsed}
    >
      {/* ── Skip link ───────────────────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground focus:text-sm focus:font-semibold"
      >
        Przejdź do treści
      </a>

      {/* ── Desktop Sidebar (Hidden on mobile) ────────────────────── */}
      <aside
        style={{ width: "var(--sidebar-width)" }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out overflow-hidden",
        )}
        aria-label="Nawigacja główna"
      >
        {/* Logo area */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-4 border-b border-border">
          <Link to="/" className="flex shrink-0 items-center gap-3 min-w-0">
            <SaldeoMark size={36} />
            {!collapsed && (
              <div className="min-w-0 sidebar-label-visible">
                <p className="font-display text-lg font-bold italic leading-tight text-foreground truncate">
                  Saldeo
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* Household name */}
        {!collapsed && householdName && (
          <div className="px-4 py-2 border-b border-border/50">
            <p className="text-[11px] text-muted-foreground truncate font-medium inline-flex items-center gap-2">
              <House className="w-3 h-3" /> {householdName}
            </p>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Menu">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 min-w-0",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 h-5 w-5 transition-colors",
                    active ? "stroke-[2.5px]" : "stroke-[1.5px]",
                  )}
                />
                {!collapsed && <span className="truncate sidebar-label-visible">{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div className="shrink-0 border-t border-border px-2 py-3 space-y-1">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            title="Odśwież dane"
            aria-label="Odśwież dane"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            )}
          >
            <RefreshCw
              className={cn("h-5 w-5 shrink-0 stroke-[1.5px]", refreshing && "animate-spin")}
            />
            {!collapsed && <span className="sidebar-label-visible">Odśwież dane</span>}
          </button>

          {/* User row */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              collapsed && "justify-center",
            )}
            title={collapsed ? (session?.user.email ?? "") : undefined}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent border border-accent/25">
              {avatarLetter}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 sidebar-label-visible">
                <p className="truncate text-sm font-medium text-foreground leading-tight">
                  {nickname}
                </p>
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  {session?.user.email}
                </p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={signOutInProgress}
            title="Wyloguj się"
            aria-label="Wyloguj się"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0 stroke-[1.5px]" />
            {!collapsed && (
              <span className="sidebar-label-visible">
                {signOutInProgress ? "Wylogowywanie…" : "Wyloguj się"}
              </span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
            title={collapsed ? "Rozwiń menu" : "Zwiń menu"}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="sidebar-label-visible">Zwiń</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main View Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-[padding-left] duration-200 ease-in-out md:pl-[var(--sidebar-width)]">
        {/* Mobile header (hidden on md+) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm px-4 md:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <SaldeoMark size={30} />
            <span className="font-display text-base font-bold italic">Saldeo</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-label="Odśwież dane"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent border border-accent/25">
              {avatarLetter}
            </div>
          </div>
        </header>

        {/* Unified Outlet container */}
        <main id="main-content" className="flex-1 pb-20 md:pb-6">
          <Outlet />
          <Toaster position="top-right" expand={false} richColors />
        </main>

        <footer className="border-t border-border px-4 py-3 pb-6 md:px-6 md:py-4 md:pb-4">
          <p className="text-[11px] md:text-xs text-muted-foreground/60 text-center">
            Wartości szacunkowe · Stawki ZUS/PIT 2025 ·{" "}
            {typeof window !== "undefined" && window.innerWidth >= 768
              ? "Dane synchronizowane · "
              : ""}
            © 2025 Saldeo
          </p>
        </footer>

        {/* Mobile bottom tab bar (hidden on md+) */}
        <nav
          aria-label="Nawigacja mobilna"
          className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] flex items-stretch justify-around shadow-[0_-4px_20px_oklch(0.15_0.018_210/0.08)] md:hidden"
          style={{ minHeight: 64 }}
        >
          {mobileNav.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            const isMore = n.isMore;
            const moreActive = moreNavItems.some((item) =>
              item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to),
            );

            if (isMore) {
              return (
                <DropdownMenu key={n.to}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 px-0.5 rounded-xl transition-all duration-150 active:scale-90 min-h-[44px]",
                        moreActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          moreActive ? "stroke-[2.5px]" : "stroke-[1.5px]",
                        )}
                        aria-hidden="true"
                      />
                      <span className="text-[10px] font-semibold truncate w-full text-center leading-tight">
                        {n.label}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="mb-2">
                    {moreNavItems.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive =
                        item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
                      return (
                        <DropdownMenuItem key={item.to} asChild>
                          <Link
                            to={item.to}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              itemActive && "bg-accent text-accent-foreground",
                            )}
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 px-0.5 rounded-xl transition-all duration-150 active:scale-90 min-h-[44px]",
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 shrink-0", active ? "stroke-[2.5px]" : "stroke-[1.5px]")}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-semibold truncate w-full text-center leading-tight">
                  {n.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
