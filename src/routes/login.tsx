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

function LoginPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuthSession();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const hasInvite = useMemo(() => !!search.invite, [search.invite]);

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!authLoading && session) {
      void router.navigate({ to: "/" });
    }
  }, [authLoading, session, router]);

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
          setStatus({ msg: translateAuthError(error.message), type: "error" });
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await initCloudSync(data.session);
          if (search.invite) {
            await acceptInvite(search.invite, data.session);
          }
        }
        setStatus({ msg: "Zalogowano pomyślnie.", type: "success" });
        await router.navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setStatus({ msg: translateAuthError(error.message), type: "error" });
          return;
        }
        setStatus({
          msg: "Konto utworzone. Sprawdź skrzynkę i potwierdź adres email, a następnie zaloguj się.",
          type: "success",
        });
        setMode("login");
        setPassword("");
      }
    } finally {
      setLoading(false);
    }
  }

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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Proszę czekać…" : mode === "login" ? "Zaloguj" : "Utwórz konto"}
        </Button>
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
            Masz zaproszenie do wspólnego gospodarstwa. Po zalogowaniu zostanie zaakceptowane
            automatycznie.
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
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Zbyt wiele prób. Poczekaj chwilę i spróbuj ponownie.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Błąd sieci. Sprawdź połączenie z internetem.";
  }
  // Fallback — return original for unknown errors
  return msg;
}
