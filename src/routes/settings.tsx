import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthSession } from "@/lib/auth";
import { createInvite } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { actions, useAppState } from "@/lib/store";
import { Separator } from "@/components/ui/separator";
import { formatPLN } from "@/lib/salary";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAuthenticated } = useAuthSession();
  const globalSettings = useAppState((s) => s.globalSettings);
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
        setStatus({
          msg: "Nie udało się utworzyć zaproszenia. Upewnij się, że jesteś zalogowany i spróbuj ponownie.",
          type: "error",
        });
        return;
      }
      setInviteLink(link);
      setStatus({
        msg: "Zaproszenie utworzone. Skopiuj link poniżej i wyślij go zapraszanej osobie.",
        type: "success",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Nie udało się utworzyć zaproszenia.";
      setStatus({ msg, type: "error" });
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

      <Separator className="my-10" />

      <section className="space-y-6">
        <div>
          <h2 className="font-display text-2xl">Parametry podatkowe i ZUS</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Te parametry są wspólne dla wszystkich kalkulacji w gospodarstwie. Pozwalają dostosować
            aplikację do zmian w przepisach (np. na rok 2026).
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
          <div className="grid sm:grid-cols-2 gap-8">
            {/* Average Salary Forecast */}
            <div className="space-y-2">
              <Label htmlFor="avg-salary">Prognozowane przeciętne wynagrodzenie (miesięczne)</Label>
              <Input
                id="avg-salary"
                type="number"
                value={globalSettings.avgSalaryForecast}
                onChange={(e) =>
                  actions.updateGlobalSettings({
                    avgSalaryForecast: parseFloat(e.target.value) || 0,
                  })
                }
                className="font-mono"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] text-muted-foreground italic">
                  Dla roku 2025: 8 673 zł
                </p>
                <p className="text-[10px] font-semibold text-accent">
                  Limit 30-krotności: {formatPLN(globalSettings.avgSalaryForecast * 30)}
                </p>
              </div>
            </div>

            {/* PIT Threshold */}
            <div className="space-y-2">
              <Label htmlFor="pit-threshold">II próg podatkowy (roczny)</Label>
              <Input
                id="pit-threshold"
                type="number"
                value={globalSettings.pitThresholdAnnual}
                onChange={(e) =>
                  actions.updateGlobalSettings({
                    pitThresholdAnnual: parseFloat(e.target.value) || 0,
                  })
                }
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground italic">Obecnie: 120 000 zł</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {/* Rates */}
            <div className="space-y-2">
              <Label htmlFor="pit-rate-1">Stawka I (PIT)</Label>
              <div className="relative">
                <Input
                  id="pit-rate-1"
                  type="number"
                  value={globalSettings.pitFirstRate}
                  onChange={(e) =>
                    actions.updateGlobalSettings({ pitFirstRate: parseFloat(e.target.value) || 0 })
                  }
                  className="pr-8 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pit-rate-2">Stawka II (PIT)</Label>
              <div className="relative">
                <Input
                  id="pit-rate-2"
                  type="number"
                  value={globalSettings.pitSecondRate}
                  onChange={(e) =>
                    actions.updateGlobalSettings({ pitSecondRate: parseFloat(e.target.value) || 0 })
                  }
                  className="pr-8 font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-free">Kwota wolna (roczna)</Label>
              <Input
                id="tax-free"
                type="number"
                value={globalSettings.taxFreeAmountAnnual}
                onChange={(e) =>
                  actions.updateGlobalSettings({
                    taxFreeAmountAnnual: parseFloat(e.target.value) || 0,
                  })
                }
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground italic">Obecnie: 30 000 zł</p>
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-xl p-4 flex gap-3 items-start border border-dashed border-border">
             <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
             <p className="text-xs text-muted-foreground leading-relaxed">
               <strong>Wskazówka:</strong> Zmiana tych wartości natychmiast wpłynie na wszystkie wyliczenia netto, 
               uśrednienia roczne oraz prognozy oszczędności na pulpicie. Pozwala to na symulację 
               scenariuszy "co jeśli" (np. jeśli kwota wolna wzrośnie do 60k).
             </p>
          </div>
        </div>
      </section>
    </main>
  );
}
