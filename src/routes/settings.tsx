import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuthSession } from "@/lib/auth";
import { createInvite, getCachedHouseholdName, getCachedMembers, getMemberDisplayName, getActiveHouseholdId } from "@/lib/store";
import {
  loadHouseholdInvites,
  loadHouseholdMemberProfiles,
  removeHouseholdMember,
  revokeHouseholdInvite,
  updateHouseholdName,
  type MemberProfile,
} from "@/lib/repository";
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
  const [inviteRecipient, setInviteRecipient] = useState("");
  const [shareSupported, setShareSupported] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: "error" | "success" | "info" } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<
    { id: string; email: string; expires_at: string; status: string }[]
  >([]);
  const [isOwner, setIsOwner] = useState(false);
  const { session } = useAuthSession();

  async function refreshHouseholdInfo() {
    const householdId = getActiveHouseholdId();
    if (!householdId) return;

    const memberProfiles = await loadHouseholdMemberProfiles(householdId);
    const invites = await loadHouseholdInvites(householdId, false);

    setMembers(memberProfiles);
    setPendingInvites(invites);
    setIsOwner(memberProfiles.some((member) => member.user_id === session?.user.id && member.role === "owner"));
  }

  async function handleSaveName() {
    if (!householdName.trim()) {
      setStatus({ msg: "Nazwa gospodarstwa nie może być pusta.", type: "error" });
      return;
    }
    const householdId = getActiveHouseholdId();
    if (!householdId) return;
    
    const success = await updateHouseholdName(householdId, householdName.trim());
    if (success) {
      setEditingName(false);
      setStatus({ msg: "Nazwa gospodarstwa została zmieniona.", type: "success" });
    } else {
      setStatus({ msg: "Nie udało się zmienić nazwy gospodarstwa.", type: "error" });
    }
  }

  useEffect(() => {
    const cached = getCachedHouseholdName();
    setHouseholdName(cached ?? "");
  }, []);

  useEffect(() => {
    void refreshHouseholdInfo();
  }, [session]);

  useEffect(() => {
    setShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const handleMetaChange = () => {
      void refreshHouseholdInfo();
    };
    window.addEventListener("household:meta-change", handleMetaChange);
    return () => window.removeEventListener("household:meta-change", handleMetaChange);
  }, [session]);

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
    const recipient = email.trim();
    if (!recipient) {
      setStatus({ msg: "Podaj adres email.", type: "error" });
      return;
    }
    setLoading(true);
    setStatus(null);
    setInviteLink("");
    setInviteRecipient("");
    try {
      const link = await createInvite(recipient);
      if (!link) {
        setStatus({
          msg: "Nie udało się utworzyć zaproszenia. Upewnij się, że jesteś zalogowany i spróbuj ponownie.",
          type: "error",
        });
        return;
      }
      setInviteLink(link);
      setInviteRecipient(recipient);
      setStatus({
        msg: "Zaproszenie utworzone. Udostępnij link poniżej lub wyślij je bezpośrednio na email zapraszanej osoby.",
        type: "success",
      });
      setEmail("");
      await refreshHouseholdInfo();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Nie udało się utworzyć zaproszenia.";
      setStatus({ msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function buildMailtoLink() {
    if (!inviteRecipient || !inviteLink) return "";
    const subject = "Zaproszenie do Net Salary Navigator";
    const body = `Cześć,

Zostałeś zaproszony do wspólnego gospodarstwa w aplikacji Net Salary Navigator.
Kliknij ten link, aby dołączyć:

${inviteLink}

Jeśli nie masz jeszcze konta, zarejestruj się tym samym adresem email.`;
    return `mailto:${encodeURIComponent(inviteRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function handleSendEmail() {
    const href = buildMailtoLink();
    if (!href) return;
    window.location.href = href;
  }

  async function handleShare() {
    if (!inviteLink || !shareSupported) return;
    try {
      await navigator.share({
        title: "Zaproszenie do Net Salary Navigator",
        text: "Dołącz do wspólnego gospodarstwa:",
        url: inviteLink,
      });
    } catch {
      setStatus({ msg: "Udostępnianie nie powiodło się. Spróbuj skopiować link ręcznie.", type: "error" });
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

  async function handleRevokeInvite(inviteId: string) {
    setLoading(true);
    setStatus(null);
    const revoked = await revokeHouseholdInvite(inviteId);
    if (!revoked) {
      setStatus({ msg: "Nie udało się unieważnić zaproszenia.", type: "error" });
      setLoading(false);
      return;
    }
    setStatus({ msg: "Zaproszenie zostało unieważnione.", type: "success" });
    await refreshHouseholdInfo();
    setLoading(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!session?.user.id) return;
    if (!isOwner) {
      setStatus({ msg: "Tylko właściciel może usuwać członków.", type: "error" });
      return;
    }
    if (userId === session.user.id) {
      setStatus({ msg: "Nie możesz usunąć siebie. Aby opuścić gospodarstwo, wyloguj się.", type: "error" });
      return;
    }

    setLoading(true);
    setStatus(null);
    const householdId = getActiveHouseholdId();
    if (!householdId) {
      setStatus({ msg: "Nie znaleziono aktywnego gospodarstwa.", type: "error" });
      setLoading(false);
      return;
    }

    const removed = await removeHouseholdMember(householdId, userId);
    if (!removed) {
      setStatus({ msg: "Nie udało się usunąć członka gospodarstwa.", type: "error" });
      setLoading(false);
      return;
    }
    setStatus({ msg: "Członek został usunięty.", type: "success" });
    await refreshHouseholdInfo();
    setLoading(false);
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
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Link zaproszenia:</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={inviteLink} readOnly className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleCopy()}
                >
                  {copied ? "Skopiowano ✓" : "Kopiuj"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleSendEmail()}
                >
                  Wyślij email
                </Button>
                {shareSupported ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void handleShare()}
                  >
                    Udostępnij
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Możesz wysłać zaproszenie bezpośrednio na email zaproszonej osoby lub skopiować link i wkleić go w dowolnym komunikatorze.
            </p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Stan gospodarstwa
          </p>
          <div className="flex items-center gap-2 mb-3">
            {editingName ? (
              <input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                autoFocus
                className="text-base font-semibold px-2 py-1 border border-border rounded-md bg-background"
              />
            ) : (
              <h3 className="text-base font-semibold">{householdName}</h3>
            )}
            {isOwner && (
              <button
                onClick={() => setEditingName(!editingName)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-sm text-foreground mb-3">
            Gospodarstwo domowe jest współdzielone między członków. Zmiany w danych są synchronizowane dla wszystkich.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Liczba członków</span>
              <strong className="text-foreground">{members.length}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Oczekujące zaproszenia</span>
              <strong className="text-foreground">
                {pendingInvites.filter((invite) => invite.status === "pending").length}
              </strong>
            </div>
            {session?.user.id && (
              <div className="flex justify-between gap-3">
                <span>Twoja rola</span>
                <strong className="text-foreground">
                  {members.find((member) => member.user_id === session.user.id)?.role ?? "member"}
                </strong>
              </div>
            )}
            {session?.user.email && (
              <div className="flex justify-between gap-3">
                <span>Twój email</span>
                <strong className="text-foreground">{session.user.email}</strong>
              </div>
            )}
            {isOwner && (
              <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
                Jako właściciel możesz usuwać członków gospodarstwa i unieważniać zaproszenia.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Członkowie gospodarstwa
          </p>
          {members.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {members.map((member) => (
                <li key={member.user_id} className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{getMemberDisplayName(member)}</p>
                    <p className="text-xs text-muted-foreground">{member.email} · {member.role}</p>
                    {session?.user.id === member.user_id && (
                      <p className="text-xs text-muted-foreground">(Twoje konto)</p>
                    )}
                  </div>
                  {isOwner && member.user_id !== session?.user.id ? (
                    <Button size="sm" variant="outline" onClick={() => void handleRemoveMember(member.user_id)} disabled={loading}>
                      Usuń
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Brak aktywnych członków.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Zaproszenia
        </p>
        {pendingInvites.length > 0 ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.status === "pending" ? "Ważne do:" : "Status:"}{" "}
                    {invite.status === "pending"
                      ? new Date(invite.expires_at).toLocaleString()
                      : invite.status}
                  </p>
                </div>
                {isOwner && invite.status === "pending" ? (
                  <Button size="sm" variant="outline" onClick={() => void handleRevokeInvite(invite.id)} disabled={loading}>
                    Unieważnij
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Brak oczekujących zaproszeń.</p>
        )}
      </div>

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
