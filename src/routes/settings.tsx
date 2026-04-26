import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthSession } from "@/lib/auth";
import { createInvite } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAuthenticated } = useAuthSession();
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isAuthenticated) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-sm text-muted-foreground">
          Zaloguj się, aby zarządzać udostępnianiem.{" "}
          <Link to="/login" search={{ invite: undefined }}>
            Przejdź do logowania
          </Link>
        </p>
      </main>
    );
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setStatus({ msg: "Podaj adres email.", type: "error" });
      return;
    }
    setLoading(true);
    setStatus(null);
    setInviteLink("");
    try {
      const link = await createInvite(email.trim());
      if (!link) {
        setStatus({ msg: "Nie udało się utworzyć zaproszenia. Upewnij się, że jesteś zalogowany i spróbuj ponownie.", type: "error" });
        return;
      }
      setInviteLink(link);
      setStatus({ msg: "Zaproszenie utworzone. Skopiuj link poniżej i wyślij go zapraszanej osobie.", type: "success" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      <h1 className="font-display text-3xl">Ustawienia i udostępnianie</h1>
      <p className="text-sm text-muted-foreground">
        Wygeneruj zaproszenie do wspólnego gospodarstwa (pełny dostęp edycji).
      </p>
      <form
        className="bg-card border border-border rounded-2xl p-5 space-y-3"
        onSubmit={(e) => void handleCreateInvite(e)}
        noValidate
      >
        <Input
          id="invite-email"
          type="email"
          placeholder="Adres email zapraszanej osoby"
          value={email}
          autoComplete="email"
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Tworzenie…" : "Utwórz zaproszenie"}
        </Button>

        {!!inviteLink && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Link zaproszenia:</p>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void handleCopy()}
              >
                {copied ? "Skopiowano ✓" : "Kopiuj"}
              </Button>
            </div>
          </div>
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
