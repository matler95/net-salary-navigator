import { useMemo, useState, useEffect, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";
import { acceptInvite, initCloudSync } from "@/lib/store";
import { loadInviteContext } from "@/lib/repository";
import { useAuthSession } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" && search.invite ? search.invite : undefined,
    register: typeof search.register === "string" && search.register === "1" ? "1" : undefined,
  }),
});

const PENDING_INVITE_KEY = "placa-netto-pending-invite-token";

type InviteContext = {
  household_id: string;
  household_name: string;
  email: string;
  status: string;
  expires_at: string;
  is_valid: boolean;
};

function LoginPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuthSession();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("Moje gospodarstwo");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<"login" | "register">(() =>
    typeof window !== "undefined" && search.register ? "register" : "login",
  );
  const [status, setStatus] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const hasInvite = useMemo(() => !!search.invite, [search.invite]);
  const inviteEmail = inviteContext?.email ?? "";

  useEffect(() => {
    if (!search.invite || typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_INVITE_KEY, search.invite);
  }, [search.invite]);

  useEffect(() => {
    if (!search.invite) return;
    setInviteLoading(true);
    setInviteError(null);

    loadInviteContext(search.invite)
      .then((context) => {
        if (!context || !context.is_valid) {
          setInviteError("Nieprawidłowe lub wygasłe zaproszenie.");
          setInviteContext(null);
          return;
        }
        setInviteContext(context);
        setEmail(context.email);
      })
      .catch((error) => {
        console.error("Error loading invite context:", error);
        setInviteError("Nie udało się zweryfikować zaproszenia.");
      })
      .finally(() => setInviteLoading(false));
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
        const result = await acceptInvite(pendingInvite, session);
        if (!cancelled && result.success) {
          if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_KEY);
          await router.navigate({ to: "/" });
          return;
        } else if (!cancelled && typeof window !== "undefined") {
          // Clean up invalid/expired pending invite
          window.localStorage.removeItem(PENDING_INVITE_KEY);
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
    if (mode === "register" && !hasInvite && !householdName.trim()) return "Podaj nazwę gospodarstwa.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
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

    const pendingInvite =
      search.invite ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem(PENDING_INVITE_KEY) ?? undefined
        : undefined);

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
          if (pendingInvite) {
            const result = await acceptInvite(pendingInvite, data.session);
            if (!result.success) {
              setStatus({
                msg:
                  result.error ||
                  "Nie udało się dołączyć do gospodarstwa z linku. Upewnij się, że logujesz się na ten sam email, na który wysłano zaproszenie.",
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
        const signUpPayload = {
          email: email.trim(),
          password,
          options: {
            data: nickname ? { nickname } : undefined,
            ...(hasInvite && search.invite
              ? { emailRedirectTo: `${window.location.origin}/login?invite=${encodeURIComponent(search.invite)}` }
              : {}),
          },
        };
        const { data: signUpData, error } = await supabase.auth.signUp(signUpPayload);
        if (error) {
          console.log("Signup error:", error.message, error.status);
          const message = error.message.toLowerCase();
          if (message.includes("already registered") || message.includes("duplicate") || message.includes("email already in use")) {
            setMode("login");
            setStatus({
              msg: "Konto już istnieje. Zaloguj się, aby dokończyć dołączenie do gospodarstwa.",
              type: "info",
            });
            return;
          }
          if (message.includes("too many requests") || message.includes("429") || message.includes("rate limit") || message.includes("exceeded")) {
            setCooldownSeconds(60);
          }
          setStatus({ msg: translateAuthError(error.message), type: "error" });
          return;
        }
        if (signUpData?.session) {
          if (pendingInvite) {
            const result = await acceptInvite(pendingInvite, signUpData.session);
            if (!result.success) {
              setStatus({
                msg:
                  result.error ||
                  "Nie udało się dołączyć do gospodarstwa z linku. Upewnij się, że rejestrujesz się na ten sam email, na który wysłano zaproszenie.",
                type: "error",
              });
              return;
            }
            if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_KEY);
          } else {
            await initCloudSync(signUpData.session, null, householdName.trim() || undefined);
          }
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
          {inviteLoading ? (
            <p className="mt-2">Ładowanie szczegółów zaproszenia…</p>
          ) : (
            <>
              <p className="mt-2">
                Użyj tego samego adresu email, na który wysłano zaproszenie.
                Jeśli już masz konto, zaloguj się, aby dołączyć do gospodarstwa.
                Jeśli nie masz konta, utwórz je tym adresem — wystarczy podać hasło.
              </p>
              {inviteContext?.household_name ? (
                <p className="mt-2 text-sm text-foreground/80">
                  Zaproszenie do gospodarstwa: <strong>{inviteContext.household_name}</strong>
                </p>
              ) : null}
            </>
          )}
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
          disabled={loading || (hasInvite && !!inviteEmail)}
          onChange={(e) => setEmail(e.target.value)}
        />
        {hasInvite && inviteEmail && (
          <p className="text-xs text-muted-foreground">
            Wykryto zaproszenie dla adresu <strong>{inviteEmail}</strong>. Nie można używać innego adresu.
          </p>
        )}
        <Input
          id="login-password"
          type="password"
          placeholder="hasło"
          value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "register" && !hasInvite ? (
          <Input
            id="household-name"
            type="text"
            placeholder="Nazwa gospodarstwa"
            value={householdName}
            disabled={loading}
            onChange={(e) => setHouseholdName(e.target.value)}
          />
        ) : null}
        {mode === "register" ? (
          <Input
            id="nickname"
            type="text"
            placeholder="Twoja ksywka"
            value={nickname}
            disabled={loading}
            onChange={(e) => setNickname(e.target.value)}
          />
        ) : null}
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
