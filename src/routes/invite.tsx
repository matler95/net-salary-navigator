import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { useAuthSession } from "@/lib/auth";
import { acceptInvite, PENDING_INVITE_TOKEN_KEY } from "@/lib/store";
import { loadInviteContext } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const router = useRouter();
  const { session, isAuthenticated, loading: authLoading } = useAuthSession();
  const search = Route.useSearch();
  const token = useMemo(() => search.invite?.trim() ?? "", [search.invite]);
  const [invite, setInvite] = useState<InviteContext | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "error" | "info" | "success" } | null>(null);

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
        setStatus({ msg: "Błąd ładowania zaproszenia. Spróbuj ponownie później.", type: "error" });
      })
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleAccept() {
    if (!session || !token) return;
    setAccepting(true);
    setStatus(null);

    const accepted = await acceptInvite(token, session);
    if (accepted) {
      toast.success(`Dołączono do gospodarstwa ${invite?.household_name ?? "gospodarstwa"}`);
      await router.navigate({ to: "/" });
      return;
    }

    setStatus({
      msg: "Nie udało się dołączyć do gospodarstwa. Upewnij się, że używasz właściwego konta e-mail.",
      type: "error",
    });
    setAccepting(false);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    setRegistering(true);
    setStatus(null);

    const supabase = await getSupabase();
    if (!supabase) {
      setStatus({ msg: "Brak konfiguracji Supabase.", type: "error" });
      setRegistering(false);
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/invite?invite=${encodeURIComponent(token)}`,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already registered") || message.includes("duplicate") || message.includes("email already in use")) {
        await router.navigate({ to: "/login", search: { invite: token } });
        return;
      }
      setStatus({ msg: error.message, type: "error" });
      setRegistering(false);
      return;
    }

    if (signUpData?.session) {
      const accepted = await acceptInvite(token, signUpData.session);
      if (!accepted) {
        setStatus({
          msg: "Nie udało się dołączyć do gospodarstwa. Spróbuj zalogować się na ten sam email.",
          type: "error",
        });
        setRegistering(false);
        return;
      }
      if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
      toast.success(`Dołączono do gospodarstwa ${invite.household_name}`);
      await router.navigate({ to: "/" });
      return;
    }

    setStatus({
      msg: "Konto zostało utworzone. Jeżeli w projekcie wymagana jest weryfikacja email, sprawdź skrzynkę i wróć do aplikacji.",
      type: "success",
    });
    setRegistering(false);
  }

  async function handleLogoutAndContinue() {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.navigate({ to: "/login", search: { invite: token } });
  }

  if (!token) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-display">Brak zaproszenia</h1>
        <p className="mt-3 text-sm text-muted-foreground">Ten link nie zawiera poprawnego tokenu zaproszenia.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Przejdź do aplikacji
          </Link>
        </div>
      </main>
    );
  }

  const inviteEmail = invite?.email ?? "adres email";
  const householdName = invite?.household_name ?? "gospodarstwo";
  const alreadyJoined = invite?.status === "accepted";
  const inviteExpired = invite?.status !== "pending" && !invite?.is_valid;
  const wrongAccount = isAuthenticated && session?.user.email && inviteEmail && session.user.email.toLowerCase() !== inviteEmail.toLowerCase();

  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.24em] text-accent font-semibold">Zaproszenie</p>
          <h1 className="mt-3 text-3xl font-display">Dołącz do gospodarstwa</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Zaproszenie dla <strong>{inviteEmail}</strong> do gospodarstwa <strong>{householdName}</strong>.
          </p>
        </div>

        {loadingInvite || authLoading ? (
          <div className="space-y-3">
            <div className="h-4 rounded bg-muted/50" />
            <div className="h-4 rounded bg-muted/50" />
            <div className="h-4 rounded bg-muted/50" />
          </div>
        ) : (
          <div className="space-y-6">
            {status ? (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  status.type === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground"
                }`}
              >
                {status.msg}
              </div>
            ) : null}

            {alreadyJoined ? (
              <div className="rounded-2xl border border-border bg-muted p-6 text-sm text-foreground">
                Zaproszenie zostało już przyjęte. Możesz teraz przejść do pulpitu.
              </div>
            ) : null}

            {wrongAccount ? (
              <div className="rounded-2xl border border-border bg-muted p-6 space-y-4 text-sm text-foreground">
                <p>
                  Jesteś zalogowany jako <strong>{session?.user.email}</strong>, a zaproszenie jest wystawione dla <strong>{inviteEmail}</strong>.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleLogoutAndContinue} variant="outline">
                    Wyloguj się i użyj właściwego konta
                  </Button>
                  <Link
                    to="/login"
                    search={{ invite: token }}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Zmień konto
                  </Link>
                </div>
              </div>
            ) : null}

            {alreadyJoined ? (
              <Button onClick={() => router.navigate({ to: "/" })}>Przejdź do pulpitu</Button>
            ) : isAuthenticated && !wrongAccount ? (
              <Button onClick={handleAccept} disabled={accepting || !invite?.is_valid}>
                {accepting ? "Dołączanie…" : `Dołącz do ${householdName}`}
              </Button>
            ) : invite?.is_valid ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Aby dołączyć do gospodarstwa, ustal tylko hasło dla konta <strong>{inviteEmail}</strong>.
                  Adres email jest już zablokowany na podstawie zaproszenia.
                </p>
                <form className="space-y-4" onSubmit={(e) => void handleRegister(e)}>
                  <Input id="invite-email" type="email" value={inviteEmail} disabled />
                  <Input
                    id="invite-password"
                    type="password"
                    placeholder="Nowe hasło"
                    value={password}
                    disabled={registering}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button type="submit" disabled={registering || !password.trim()}>
                    {registering ? "Tworzenie konta…" : "Utwórz konto i dołącz"}
                  </Button>
                </form>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Masz już konto? Zaloguj się, aby dokończyć proces dołączenia do gospodarstwa.</p>
                  <Link
                    to="/login"
                    search={{ invite: token }}
                    className="inline-flex items-center justify-center rounded-full bg-background border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Zaloguj się
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted p-6 text-sm text-foreground">
                Nie można obsłużyć tego zaproszenia. Skontaktuj się z osobą, która je wysłała, lub spróbuj ponownie później.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
