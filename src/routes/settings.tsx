import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Leaf, Calculator, Zap, User } from "lucide-react";
import { useAuthSession } from "@/lib/auth";
import {
  createInvite,
  getCachedHouseholdName,
  getCachedMembers,
  getMemberDisplayName,
  getActiveHouseholdId,
} from "@/lib/store";
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
import { formatPLN, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";

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

  const refreshHouseholdInfo = useCallback(async () => {
    const householdId = getActiveHouseholdId();
    if (!householdId) return;

    const memberProfiles = await loadHouseholdMemberProfiles(householdId);
    const invites = await loadHouseholdInvites(householdId, false);

    setMembers(memberProfiles);
    setPendingInvites(invites);

    if (session?.user.id) {
      const me = memberProfiles.find((m) => m.user_id === session.user.id);
      setIsOwner(me?.role === "owner");
    }
  }, [session?.user.id]);

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
  }, [session, refreshHouseholdInfo]);

  useEffect(() => {
    setShareSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const handleMetaChange = () => {
      void refreshHouseholdInfo();
    };
    window.addEventListener("household:meta-change", handleMetaChange);
    return () => window.removeEventListener("household:meta-change", handleMetaChange);
  }, [session, refreshHouseholdInfo]);

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
      setStatus({
        msg: "Udostępnianie nie powiodło się. Spróbuj skopiować link ręcznie.",
        type: "error",
      });
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
      setStatus({
        msg: "Nie możesz usunąć siebie. Aby opuścić gospodarstwo, wyloguj się.",
        type: "error",
      });
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
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ustawienia</h1>
        <p className="text-muted-foreground leading-relaxed">
          Zarządzaj swoim gospodarstwem domowym i konfiguruj parametry finansowe.
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <User className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl font-semibold">Udostępnianie</h2>
        </div>

        <div className="grid gap-6">
          <div className="bg-card border border-border rounded-[2rem] p-8 shadow-warm space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-1">Zaproś domownika</h3>
              <p className="text-sm text-muted-foreground">
                Wygeneruj link zaproszenia, aby wspólnie zarządzać budżetem w czasie rzeczywistym.
              </p>
            </div>

            <form className="space-y-4" onSubmit={(e) => void handleCreateInvite(e)} noValidate>
              <div className="space-y-2">
                <Label
                  htmlFor="invite-email"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Email zapraszanej osoby
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="np. anna.nowak@example.com"
                    value={email}
                    autoComplete="email"
                    disabled={loading}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 rounded-xl"
                  />
                  <Button type="submit" disabled={loading} className="rounded-xl shadow-md">
                    {loading ? "Tworzenie…" : "Utwórz zaproszenie"}
                  </Button>
                </div>
              </div>

              {!!inviteLink && (
                <div className="p-6 rounded-2xl bg-accent-soft/30 border border-accent/10 space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">
                      Link zaproszenia
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        value={inviteLink}
                        readOnly
                        className="font-mono text-xs bg-background/50 border-accent/20"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="accent"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void handleCopy()}
                        >
                          {copied ? "Skopiowano ✓" : "Kopiuj link"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void handleSendEmail()}
                        >
                          Wyślij email
                        </Button>
                        {shareSupported ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => void handleShare()}
                          >
                            Udostępnij
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>Ważne:</strong> Zaproszenie wygaśnie za 7 dni. Osoba zaproszona musi
                    posiadać konto z tym samym adresem email.
                  </p>
                </div>
              )}

              {status && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    status.type === "error"
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : status.type === "success"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status.msg}
                </div>
              )}
            </form>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] border border-border bg-card p-8 shadow-warm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-1">
                    Stan gospodarstwa
                  </p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                        autoFocus
                        className="text-base font-semibold h-9 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h3 className="text-xl font-display font-semibold">{householdName}</h3>
                      {isOwner && (
                        <button
                          onClick={() => setEditingName(true)}
                          className="p-1 text-muted-foreground hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Leaf className="w-6 h-6" />
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Twoje dane są bezpiecznie synchronizowane między wszystkimi członkami
                  gospodarstwa.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                      Członkowie
                    </p>
                    <p className="text-xl font-display font-bold">{members.length}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                      Oczekujące
                    </p>
                    <p className="text-xl font-display font-bold">
                      {pendingInvites.filter((i) => i.status === "pending").length}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  {session?.user.email && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Twój email:</span>
                      <span className="font-semibold text-foreground truncate max-w-[150px]">
                        {session.user.email}
                      </span>
                    </div>
                  )}
                  {session?.user.id && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Twoja rola:</span>
                      <div className="px-2 py-0.5 rounded-full bg-accent-soft text-accent font-bold uppercase text-[9px] tracking-widest">
                        {members.find((m) => m.user_id === session.user.id)?.role ?? "member"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-8 shadow-warm flex flex-col">
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-1">
                  Członkowie
                </p>
                <h3 className="text-xl font-display font-semibold">Lista osób</h3>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar space-y-3">
                {members.length > 0 ? (
                  members.map((member) => (
                    <div
                      key={member.user_id}
                      className="p-4 rounded-2xl bg-background/50 border border-border/50 flex items-center justify-between group transition-all hover:border-accent/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                          {getMemberDisplayName(member)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {getMemberDisplayName(member)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      {isOwner && member.user_id !== session?.user.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-8 text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100"
                          onClick={() => void handleRemoveMember(member.user_id)}
                          disabled={loading}
                        >
                          Usuń
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-xs text-muted-foreground">
                    Brak aktywnych członków.
                  </p>
                )}
              </div>
            </div>
          </div>

          {pendingInvites.filter((i) => i.status === "pending").length > 0 && (
            <div className="rounded-[2rem] border border-border bg-card p-8 shadow-warm">
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-1">
                  Oczekujące zaproszenia
                </p>
                <h3 className="text-xl font-display font-semibold">Zarządzaj linkami</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {pendingInvites
                  .filter((i) => i.status === "pending")
                  .map((invite) => (
                    <div
                      key={invite.id}
                      className="p-4 rounded-2xl bg-background/50 border border-border/50 flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate mb-1">{invite.email}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                          Ważne do: {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-8 px-3 text-[10px] font-bold uppercase text-destructive hover:bg-destructive/10"
                          onClick={() => void handleRevokeInvite(invite.id)}
                          disabled={loading}
                        >
                          Unieważnij
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Separator className="bg-border/60" />

      <section className="space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <Calculator className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl font-semibold">Podatki i ZUS</h2>
        </div>

        <div className="bg-card border border-border rounded-[2.5rem] p-8 sm:p-10 shadow-warm space-y-10">
          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="avg-salary"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Prognozowane wynagrodzenie
                </Label>
                <div className="relative">
                  <Input
                    id="avg-salary"
                    type="text"
                    inputMode="decimal"
                    value={formatLocaleAmount(globalSettings.avgSalaryForecast, 0)}
                    onChange={(e) =>
                      actions.updateGlobalSettings({
                        avgSalaryForecast: parseLocaleAmount(e.target.value),
                      })
                    }
                    className="font-display text-2xl h-14 pr-12 rounded-2xl bg-muted/30 focus:bg-background transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    zł
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium px-1">
                  <span className="text-muted-foreground italic">Dla roku 2025: 8 673 zł</span>
                  <span className="text-accent">
                    Limit 30-krotności: {formatPLN(globalSettings.avgSalaryForecast * 30)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="pit-threshold"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  II próg podatkowy (roczny)
                </Label>
                <div className="relative">
                  <Input
                    id="pit-threshold"
                    type="text"
                    inputMode="decimal"
                    value={formatLocaleAmount(globalSettings.pitThresholdAnnual, 0)}
                    onChange={(e) =>
                      actions.updateGlobalSettings({
                        pitThresholdAnnual: parseLocaleAmount(e.target.value),
                      })
                    }
                    className="font-display text-2xl h-14 pr-12 rounded-2xl bg-muted/30 focus:bg-background transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    zł
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground italic px-1">
                  Standardowo: 120 000 zł
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="pit-rate-1"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Stawka I
                </Label>
                <div className="relative">
                  <Input
                    id="pit-rate-1"
                    type="text"
                    inputMode="decimal"
                    value={formatLocaleAmount(globalSettings.pitFirstRate)}
                    onChange={(e) =>
                      actions.updateGlobalSettings({
                        pitFirstRate: parseLocaleAmount(e.target.value),
                      })
                    }
                    className="font-display text-2xl h-14 pr-8 rounded-2xl bg-muted/30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="pit-rate-2"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Stawka II
                </Label>
                <div className="relative">
                  <Input
                    id="pit-rate-2"
                    type="text"
                    inputMode="decimal"
                    value={formatLocaleAmount(globalSettings.pitSecondRate)}
                    onChange={(e) =>
                      actions.updateGlobalSettings({
                        pitSecondRate: parseLocaleAmount(e.target.value),
                      })
                    }
                    className="font-display text-2xl h-14 pr-8 rounded-2xl bg-muted/30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                    %
                  </span>
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label
                  htmlFor="tax-free"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Kwota wolna od podatku
                </Label>
                <div className="relative">
                  <Input
                    id="tax-free"
                    type="text"
                    inputMode="decimal"
                    value={formatLocaleAmount(globalSettings.taxFreeAmountAnnual, 0)}
                    onChange={(e) =>
                      actions.updateGlobalSettings({
                        taxFreeAmountAnnual: parseLocaleAmount(e.target.value),
                      })
                    }
                    className="font-display text-2xl h-14 pr-12 rounded-2xl bg-muted/30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    zł
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground italic px-1">
                  Obecnie: 30 000 zł rocznie
                </p>
              </div>
            </div>
          </div>

          <div className="bg-accent-soft/20 rounded-[2rem] p-8 flex gap-6 items-center border border-accent/10 shadow-inner">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Zap className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-lg font-semibold text-accent">
                Inteligentna Symulacja
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Zmiany w tych parametrach są odzwierciedlane natychmiast we wszystkich modułach
                aplikacji. Możesz bezpiecznie sprawdzać, jak przyszłe zmiany w prawie (np. "Kwota
                wolna 60k") wpłyną na Twoje realne oszczędności.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
