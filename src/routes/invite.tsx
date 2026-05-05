import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LogOut,
  UserPlus,
  Users,
  ArrowRight,
  ShieldCheck,
  UserCircle,
  RefreshCcw,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth";
import {
  acceptInvite,
  PENDING_INVITE_TOKEN_KEY,
  clearAppState,
  ACTIVE_HOUSEHOLD_KEY,
} from "@/lib/store";
import { loadInviteContext, updateUserMetadata } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" && search.invite ? search.invite : undefined,
  }),
});

type InviteContext = {
  household_id: string;
  household_name: string;
  email: string;
  status: string;
  expires_at: string;
  is_valid: boolean;
};

function InvitePage() {
  const baseId = useId();
  const router = useRouter();
  const { session, isAuthenticated, loading: authLoading } = useAuthSession();
  const search = Route.useSearch();
  const token = useMemo(() => search.invite?.trim() ?? "", [search.invite]);
  const [invite, setInvite] = useState<InviteContext | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "error" | "info" | "success" } | null>(
    null,
  );

  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoadingInvite(true);
    setStatus(null);

    loadInviteContext(token)
      .then((result) => {
        if (!result) {
          setStatus({ msg: "Nieprawidłowe lub wygasłe zaproszenie.", type: "error" });
          setInvite(null);
          return;
        }
        setInvite(result);
      })
      .catch((error) => {
        console.error("Error loading invite context:", error);
        setStatus({ msg: "Błąd ładowania zaproszenia.", type: "error" });
      })
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleAccept() {
    if (!session || !token) return;
    setAccepting(true);
    setStatus(null);

    if (nickname.trim()) {
      await updateUserMetadata({ nickname: nickname.trim() });
    }

    const { success, error } = await acceptInvite(token, session);
    if (success) {
      if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
      toast.success(`Witaj w gospodarstwie ${invite?.household_name ?? "gospodarstwie"}!`);
      await router.navigate({ to: "/" });
      return;
    }

    setStatus({ msg: error ?? "Błąd podczas dołączania.", type: "error" });
    setAccepting(false);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    setRegistering(true);
    setStatus(null);

    const supabase = await getSupabase();
    if (!supabase) return;

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: nickname ? { nickname } : undefined,
        emailRedirectTo: `${window.location.origin}/invite?invite=${encodeURIComponent(token)}`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already registered") || message.includes("duplicate")) {
        await router.navigate({ to: "/login", search: { invite: token, register: undefined } });
        return;
      }
      setStatus({ msg: error.message, type: "error" });
      setRegistering(false);
      return;
    }

    if (signUpData?.session) {
      const accepted = await acceptInvite(token, signUpData.session);
      if (accepted.success) {
        if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
        toast.success(`Witaj w Saldeo!`);
        await router.navigate({ to: "/" });
        return;
      }
    }

    setStatus({
      msg: "Konto utworzone. Potwierdź email w swojej skrzynce, aby dokończyć.",
      type: "success",
    });
    setRegistering(false);
  }

  async function handleSwitchAccount() {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAppState();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
    }
    toast.info("Wylogowano. Zaloguj się na właściwe konto.");
    await router.navigate({ to: "/login", search: { invite: token, register: undefined } });
  }

  if (!token) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-20 h-20 bg-muted rounded-[2rem] flex items-center justify-center mx-auto text-muted-foreground">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-display">Brak tokenu zaproszenia</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Ten link jest nieprawidłowy lub nie zawiera wymaganych danych.
        </p>
        <Button asChild className="rounded-full px-8">
          <Link to="/">Wróć do aplikacji</Link>
        </Button>
      </main>
    );
  }

  const inviteEmail = invite?.email ?? "Twój adres email";
  const householdName = invite?.household_name ?? "nowe gospodarstwo";
  const wrongAccount =
    isAuthenticated &&
    session?.user.email &&
    inviteEmail &&
    session.user.email.toLowerCase() !== inviteEmail.toLowerCase();

  return (
    <main className="min-h-screen bg-background selection:bg-accent/20 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-8 lg:gap-0 bg-card rounded-[2.5rem] border border-border shadow-[var(--shadow-elevated)] overflow-hidden animate-fade-up">
        {/* Left Side: Welcome Hero */}
        <div className="bg-accent p-8 sm:p-12 text-accent-foreground flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 scale-150 rotate-12">
            <Users className="w-48 h-48" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center font-display font-bold italic text-xl">
              S
            </div>
            <h1 className="text-4xl sm:text-5xl font-display leading-[1.1]">
              Dołącz do <span className="italic">zespołu</span>
            </h1>
            <p className="text-lg opacity-80 leading-relaxed max-w-sm">
              Zostałeś zaproszony do wspólnego zarządzania budżetem w gospodarstwie{" "}
              <span className="font-bold underline decoration-white/40">{householdName}</span>.
            </p>
          </div>

          <div className="relative z-10 pt-12">
            <div className="flex items-center gap-4 bg-black/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <UserCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider opacity-60 font-bold">
                  Zaproszenie dla
                </p>
                <p className="text-sm font-bold truncate">{inviteEmail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="p-8 sm:p-12 flex flex-col justify-center bg-card">
          {loadingInvite || authLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-3/4 bg-muted rounded-lg" />
              <div className="h-32 bg-muted rounded-2xl" />
              <div className="h-12 bg-muted rounded-full" />
            </div>
          ) : (
            <div className="space-y-8">
              {status && (
                <div
                  className={cn(
                    "p-4 rounded-2xl border text-sm flex gap-3 items-center animate-in slide-in-from-top-2",
                    status.type === "error"
                      ? "bg-destructive/5 border-destructive/20 text-destructive"
                      : "bg-success/5 border-success/20 text-success",
                  )}
                >
                  <p>{status.msg}</p>
                </div>
              )}

              {wrongAccount ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold">Złe konto?</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Jesteś obecnie zalogowany jako{" "}
                      <span className="font-bold text-foreground">{session?.user.email}</span>. To
                      zaproszenie jest przeznaczone dla kogoś innego.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handleSwitchAccount}
                      variant="outline"
                      className="w-full rounded-full h-12 gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Wyloguj i zmień konto
                    </Button>
                    <Button asChild variant="ghost" className="rounded-full">
                      <Link to="/">Przejdź do swojego pulpitu</Link>
                    </Button>
                  </div>
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display">Witaj z powrotem!</h2>
                    <p className="text-sm text-muted-foreground">
                      Potwierdź swoją ksywkę i dołącz do domowników.
                    </p>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                        Twoja ksywka
                      </Label>
                      <Input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Np. Mati"
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <Button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="w-full h-12 rounded-full gap-2 text-base shadow-warm"
                    >
                      {accepting ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                      Akceptuj zaproszenie
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display">Pierwszy raz w Saldeo?</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ustaw hasło, aby utworzyć konto i dołączyć do gospodarstwa.
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                          Ksywka
                        </Label>
                        <Input
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="Jak mamy Cię witać?"
                          className="h-12 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                          Hasło
                        </Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 6 znaków"
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={registering || !password.trim()}
                      className="w-full h-12 rounded-full gap-2 text-base shadow-warm"
                    >
                      {registering ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Utwórz konto i dołącz
                    </Button>
                  </form>

                  <div className="pt-6 border-t border-border flex flex-col items-center gap-4">
                    <p className="text-xs text-muted-foreground">Masz już konto Saldeo?</p>
                    <Button asChild variant="outline" className="w-full rounded-full h-11">
                      <Link to="/login" search={{ invite: token, register: undefined }}>
                        Zaloguj się
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
