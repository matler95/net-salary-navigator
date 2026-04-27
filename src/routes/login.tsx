import { useMemo, useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";
import { acceptInvite, initCloudSync } from "@/lib/store";
import { useAuthSession } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" && search.invite ? search.invite : undefined,
  }),
});

const PENDING_INVITE_KEY = "placa-netto-pending-invite-token";

function LoginPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuthSession();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">(() =>
    typeof window !== "undefined" && search.invite ? "register" : "login",
  );
  const [status, setStatus] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const hasInvite = useMemo(() => !!search.invite, [search.invite]);

  useEffect(() => {
    if (!search.invite || typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_INVITE_KEY, search.invite);
  }, [search.invite]);

  // Handle already-authenticated users and pending invite acceptance.
  useEffect(() => {
    if (authLoading || !session) return;
    let cancelled = false;

    const run = async () => {
      const pendingInvite =
        search.invite ??
        (typeof window !== "undefined" ? window.localStorage.getItem(PENDING_INVITE_KEY) ?? undefined : undefined);

      if (pendingInvite) {
        const accepted = await acceptInvite(pendingInvite, session);
        if (!cancelled && accepted) {
          if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_KEY);
          await router.navigate({ to: "/" });
          return;
        }
      }

      if (!cancelled) {
        await initCloudSync(session);
        await router.navigate({ to: "/" });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, session, router, search.invite]);

  function validate(): string | null {
    const trimEmail = email.trim();
    if (!trimEmail) return "Podaj adres email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) return "Nieprawidłowy format email.";
    if (!password) return "Podaj hasło.";
    if (password.length < 6) return "Hasło musi mieć co najmniej 6 znaków.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownSeconds > 0) {
      setStatus({ msg: `Zbyt wiele prób. Spróbuj ponownie za ${cooldownSeconds} sek.`, type: "error" });
      return;
    }

    const supabase = await getSupabase();
    if (!supabase) {
      setStatus({
        msg: "Brak konfiguracji Supabase (VITE_SUPABASE_URL / ANON_KEY).",
        type: "error",
      });
      return;
    }

    const validationError = validate();
    if (validationError) {
      setStatus({ msg: validationError, type: "error" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          console.log("Auth error:", error.message, error.status);
          const message = error.message.toLowerCase();
          if (message.includes("too many requests") || message.includes("429") || message.includes("rate limit") || message.includes("exceeded")) {
            setCooldownSeconds(60);
          }
          setStatus({ msg: translateAuthError(error.message), type: "error" });
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const pendingInvite =
            search.invite ??
            (typeof window !== "undefined"
              ? window.localStorage.getItem(PENDING_INVITE_KEY) ?? undefined
              : undefined);

          if (pendingInvite) {
            const accepted = await acceptInvite(pendingInvite, data.session);
            if (!accepted) {
              setStatus({
                msg: "Nie udało się dołączyć do gospodarstwa z linku. Upewnij się, że logujesz się na ten sam email, na który wysłano zaproszenie.",
                type: "error",
              });
              return;
            }
            if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_KEY);
          } else {
            await initCloudSync(data.session);
          }
        }
        setStatus({
          msg: hasInvite
            ? "Zalogowano i dołączono do gospodarstwa."
            : "Zalogowano pomyślnie.",
          type: "success",
        });
        await router.navigate({ to: "/" });
      } else {
        const signUpOptions = hasInvite && search.invite
          ? { emailRedirectTo: `${window.location.origin}/login?invite=${encodeURIComponent(search.invite)}` }
          : undefined;
        const { data: signUpData, error } = await supabase.auth.signUp(
          {
            email: email.trim(),
            password,
          },
          signUpOptions,
        );
        if (error) {
          console.log("Signup error:", error.message, error.status);
          const message = error.message.toLowerCase();
          if (message.includes("too many requests") || message.includes("429") || message.includes("rate limit") || message.includes("exceeded")) {
            setCooldownSeconds(60);
          }
          setStatus({ msg: translateAuthError(error.message), type: "error" });
          return;
        }
        if (signUpData?.session) {
          await initCloudSync(signUpData.session);
          await router.navigate({ to: "/" });
          return;
        }
        setStatus({
          msg: hasInvite
            ? "Konto utworzone. Sprawdź skrzynkę, potwierdź email, a następnie wróć do aplikacji — zaproszenie zostanie dokończone automatycznie."
            : "Konto utworzone. Sprawdź skrzynkę i potwierdź adres email, a następnie zaloguj się.",
          type: "success",
        });
        setMode("login");
        setPassword("");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Don't render the form while we're checking auth (prevents flash)
  if (authLoading) {
    return (
      <main className="max-w-xl mx-auto px-4 py-10">
        <p className="text-sm text-muted-foreground">Ładowanie…</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl mb-2">
        {mode === "login" ? "Logowanie" : "Rejestracja"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Konto umożliwia bezpieczną synchronizację danych między urządzeniami.
      </p>
      {hasInvite && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground">
          <p className="font-semibold">Zaproszenie do gospodarstwa wykryte</p>
          <p className="mt-2">
            Aby dołączyć, użyj tego samego adresu email, na który wysłano zaproszenie.
            Jeśli już masz konto, zaloguj się. Jeśli nie, zarejestruj się tym samym adresem.
          </p>
        </div>
      )}
      <form
        className="space-y-3 bg-card border border-border rounded-2xl p-5"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <Input
          id="login-email"
          type="email"
          placeholder="email"
          value={email}
          autoComplete="email"
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="login-password"
          type="password"
          placeholder="hasło"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={loading || cooldownSeconds > 0}>
          {loading
            ? "Proszę czekać…"
            : cooldownSeconds > 0
            ? `Poczekaj ${cooldownSeconds}s`
            : mode === "login"
            ? "Zaloguj"
            : "Utwórz konto"}
        </Button>
        {cooldownSeconds > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setCooldownSeconds(0)}
          >
            Reset cooldown (dla testowania)
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setStatus(null);
          }}
        >
          {mode === "login" ? "Nie masz konta? Zarejestruj" : "Masz konto? Zaloguj"}
        </Button>
        {hasInvite && (
          <p className="text-xs text-accent">
            Masz zaproszenie do wspólnego gospodarstwa. Po poprawnym logowaniu na zaproszony email
            dołączenie zostanie wykonane automatycznie.
          </p>
        )}
        {status && (
          <p
            className={`text-xs ${
              status.type === "error"
                ? "text-destructive"
                : status.type === "success"
                  ? "text-success"
                  : "text-muted-foreground"
            }`}
          >
            {status.msg}
          </p>
        )}
      </form>
    </main>
  );
}

/** Map common Supabase Auth error messages to Polish. */
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Nieprawidłowy email lub hasło.";
  }
  if (m.includes("email not confirmed")) {
    return "Adres email nie został potwierdzony. Sprawdź skrzynkę i kliknij link aktywacyjny.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Ten adres email jest już zarejestrowany.";
  }
  if (m.includes("password should be at least")) {
    return "Hasło jest za krótkie (minimum 6 znaków).";
  }
  if (m.includes("too many requests") || m.includes("429") || m.includes("rate limit") || m.includes("exceeded")) {
    return "Zbyt wiele prób. Serwer Supabase tymczasowo blokuje rejestrację z tego adresu IP. Spróbuj ponownie za kilka minut lub użyj innego adresu email.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Błąd sieci. Sprawdź połączenie z internetem.";
  }
  // Fallback — return original for unknown errors
  return msg;
}
