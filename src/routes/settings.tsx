import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useId } from "react";
import { Pencil, User, Users, Receipt, ShieldCheck, Download, Trash2, Crown, UserCircle, Target, Globe, CheckCircle2 } from "lucide-react";
import { useAuthSession } from "@/lib/auth";
import { createInvite, getCachedHouseholdName, getActiveHouseholdId, actions, useAppState } from "@/lib/store";
import {
  loadHouseholdInvites,
  loadHouseholdMemberProfiles,
  removeHouseholdMember,
  revokeHouseholdInvite,
  transferOwnership,
  updateHouseholdName,
  deleteHousehold,
  type MemberProfile,
} from "@/lib/repository";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPLN, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const baseId = useId();
  const { isAuthenticated, session } = useAuthSession();
  const globalSettings = useAppState((s) => s.globalSettings);
  
  // State for forms
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteRecipient, setInviteRecipient] = useState("");
  const [shareSupported, setShareSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<
    { id: string; email: string; expires_at: string; status: string }[]
  >([]);
  const [isOwner, setIsOwner] = useState(false);
  
  // Profile state
  const [nickname, setNickname] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const fullState = useAppState((s) => s);

  async function refreshHouseholdInfo() {
    const householdId = getActiveHouseholdId();
    if (!householdId) return;

    try {
      const memberProfiles = await loadHouseholdMemberProfiles(householdId);
      const invites = await loadHouseholdInvites(householdId, false);

      setMembers(memberProfiles);
      setPendingInvites(invites);
      setIsOwner(memberProfiles.some((member) => member.user_id === session?.user.id && member.role === "owner"));
    } catch (err) {
      console.error("Failed to refresh household info:", err);
    }
  }

  useEffect(() => {
    const cached = getCachedHouseholdName();
    setHouseholdName(cached ?? "");
    setNickname(session?.user.user_metadata?.nickname || "");
  }, [session]);

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
      <main className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
           <ShieldCheck className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-display">Dostęp ograniczony</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Zaloguj się, aby zarządzać swoim gospodarstwem i ustawieniami.
          </p>
        </div>
        <Button asChild className="rounded-full px-8">
          <Link to="/login" search={{ invite: undefined, register: undefined }}>Przejdź do logowania</Link>
        </Button>
      </main>
    );
  }

  // Handlers
  async function handleSaveHouseholdName() {
    if (!householdName.trim()) {
      toast.error("Nazwa gospodarstwa nie może być pusta.");
      return;
    }
    const householdId = getActiveHouseholdId();
    if (!householdId) return;
    
    setLoading(true);
    const success = await updateHouseholdName(householdId, householdName.trim());
    if (success) {
      setEditingName(false);
      toast.success("Nazwa została zmieniona.");
    } else {
      toast.error("Nie udało się zmienić nazwy.");
    }
    setLoading(false);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setIsUpdatingProfile(true);
    const success = await actions.updateProfile(nickname.trim());
    if (success) {
      toast.success("Profil został zaktualizowany.");
    } else {
      toast.error("Wystąpił błąd podczas aktualizacji.");
    }
    setIsUpdatingProfile(false);
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    const recipient = email.trim();
    if (!recipient) {
      toast.error("Podaj adres email.");
      return;
    }
    setLoading(true);
    try {
      const link = await createInvite(recipient);
      if (!link) {
        toast.error("Nie udało się utworzyć zaproszenia.");
        return;
      }
      setInviteLink(link);
      setInviteRecipient(recipient);
      toast.success(`Email zaproszenia wysłany na ${recipient}`);
      setEmail("");
      await refreshHouseholdInfo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zaproszenia.");
    } finally {
      setLoading(false);
    }
  }

  function handleExportData() {
    const dataStr = JSON.stringify(fullState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `saldeo-eksport-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Dane zostały wyeksportowane.");
  }

  async function handleDeleteHousehold() {
    const householdId = getActiveHouseholdId();
    if (!householdId || !isOwner) return;

    if (!confirm("UWAGA! Czy na pewno chcesz USUNĄĆ całe gospodarstwo? Ta operacja jest nieodwracalna i usunie dane WSZYSTKICH członków.")) {
      return;
    }

    setLoading(true);
    const success = await deleteHousehold(householdId);
    if (success) {
      toast.success("Gospodarstwo zostało usunięte.");
      window.location.href = "/";
    } else {
      toast.error("Błąd podczas usuwania gospodarstwa.");
    }
    setLoading(false);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <header className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
            Panel Sterowania
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Ustawienia <span className="italic text-accent">konta</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-2xl">
            Skonfiguruj swoje gospodarstwo domowe, zaproś partnera i dostosuj parametry podatkowe do aktualnych przepisów.
          </p>
        </div>
      </header>

      <Tabs defaultValue="household" className="space-y-8">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto h-auto justify-start flex border border-border/50">
          <TabsTrigger value="household" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="w-4 h-4 mr-2" />
            Gospodarstwo
          </TabsTrigger>
          <TabsTrigger value="taxes" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Receipt className="w-4 h-4 mr-2" />
            Podatki & ZUS
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="w-4 h-4 mr-2" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="data" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Dane
          </TabsTrigger>
        </TabsList>

        <TabsContent value="household" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Membership Status Card */}
              <div className="bg-card rounded-[2rem] border border-border p-8 shadow-warm">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                        <Crown className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-2xl">Twoje Gospodarstwo</h3>
                        <p className="text-xs text-muted-foreground">Synchronizowane między domownikami</p>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-3 mb-8 bg-muted/30 p-4 rounded-2xl border border-border/50">
                   {editingName ? (
                     <div className="flex gap-2 w-full">
                       <Input 
                         value={householdName} 
                         onChange={(e) => setHouseholdName(e.target.value)}
                         className="h-10 text-lg font-bold"
                         autoFocus
                       />
                       <Button size="sm" onClick={handleSaveHouseholdName} disabled={loading}>Zapisz</Button>
                       <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Anuluj</Button>
                     </div>
                   ) : (
                     <>
                       <span className="font-display text-xl font-bold">{householdName}</span>
                       {isOwner && (
                         <button onClick={() => setEditingName(true)} className="p-1.5 hover:bg-background rounded-lg transition-colors text-muted-foreground">
                            <Pencil className="w-4 h-4" />
                         </button>
                       )}
                     </>
                   )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Członkowie ({members.length})</h4>
                  <div className="space-y-3">
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/40 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-accent font-bold">
                            {m.nickname?.[0]?.toUpperCase() || m.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">{m.nickname || m.email.split("@")[0]}</p>
                              {m.role === "owner" && (
                                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[9px] px-1.5 h-4">Właściciel</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                        {isOwner && m.user_id !== session?.user.id && (
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[10px] h-8 text-muted-foreground hover:text-accent"
                              onClick={() => {
                                if(confirm(`Przekazać własność do ${m.nickname || m.email}?`)) transferOwnership(getActiveHouseholdId()!, m.user_id).then(() => refreshHouseholdInfo());
                              }}
                            >
                              Przekaż
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-[10px] h-8 border-destructive/20 text-destructive hover:bg-destructive/5"
                              onClick={() => {
                                if(confirm(`Usunąć ${m.nickname || m.email} z gospodarstwa?`)) removeHouseholdMember(getActiveHouseholdId()!, m.user_id).then(() => refreshHouseholdInfo());
                              }}
                            >
                              Usuń
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Invite Section */}
              <div className="bg-card rounded-[2rem] border border-border p-8 shadow-sm space-y-6">
                <div>
                  <h3 className="font-display text-2xl">Zaproś domownika</h3>
                  <p className="text-sm text-muted-foreground">Partner lub członek rodziny będzie widział te same dane co Ty.</p>
                </div>

                <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3">
                   <Input 
                     type="email" 
                     placeholder="Adres email" 
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     className="flex-1 rounded-xl"
                   />
                   <Button type="submit" className="rounded-xl px-6" disabled={loading}>
                      {loading ? "Wysyłanie..." : "Wyślij zaproszenie"}
                   </Button>
                </form>

                {inviteLink && (
                  <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10 space-y-3 animate-in zoom-in-95 duration-300">
                    <p className="text-xs font-bold text-accent uppercase tracking-wider">✓ Email wysłany. Link do backup:</p>
                    <div className="flex gap-2">
                       <Input readOnly value={inviteLink} className="bg-background text-xs font-mono" />
                       <Button size="sm" onClick={() => {
                         navigator.clipboard.writeText(inviteLink);
                         setCopied(true);
                         setTimeout(() => setCopied(false), 2000);
                         toast.success("Skopiowano!");
                       }}>
                         {copied ? "Skopiowano" : "Kopiuj"}
                       </Button>
                    </div>
                  </div>
                )}

                {pendingInvites.length > 0 && (
                  <div className="pt-6 border-t border-border/50">
                    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-4">Oczekujące zaproszenia</h4>
                    <div className="space-y-2">
                       {pendingInvites.map(inv => (
                         <div key={inv.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/30">
                            <span className="text-xs font-medium">{inv.email}</span>
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] text-muted-foreground">Wygasa {new Date(inv.expires_at).toLocaleDateString()}</span>
                               {isOwner && (
                                 <button 
                                   onClick={() => revokeHouseholdInvite(inv.id).then(() => refreshHouseholdInfo())}
                                   className="text-destructive hover:text-destructive/80 transition-colors"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Quick Summary Card */}
              <div className="bg-accent rounded-[2rem] p-8 text-accent-foreground shadow-warm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Globe className="w-24 h-24" />
                 </div>
                 <h3 className="font-display text-xl mb-4 relative z-10">Zasięg Twojej kontroli</h3>
                 <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                       <span className="text-xs opacity-70">Aktywnych osób</span>
                       <span className="font-display text-lg">{members.length}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                       <span className="text-xs opacity-70">Status synchronizacji</span>
                       <span className="font-display text-lg flex items-center gap-1.5">
                          On-line <CheckCircle2 className="w-4 h-4 text-white" />
                       </span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-60 italic">
                       Wszystkie dane są szyfrowane i synchronizowane w czasie rzeczywistym między Twoimi urządzeniami oraz zaproszonymi domownikami.
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-card rounded-[2rem] border border-border p-8 shadow-warm space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
                <div>
                  <h3 className="font-display text-2xl">Parametry podatkowe i ZUS</h3>
                  <p className="text-sm text-muted-foreground mt-1">Globalne wartości używane do wszystkich kalkulacji.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    if (confirm("Przywrócić wartości domyślne dla 2025?")) {
                      actions.updateGlobalSettings({
                        avgSalaryForecast: 8673,
                        pitThresholdAnnual: 120000,
                        pitFirstRate: 12,
                        pitSecondRate: 32,
                        taxFreeAmountAnnual: 30000,
                        targetEmergencyFundMonths: 6,
                      });
                      toast.success("Przywrócono domyślne.");
                    }
                  }}
                >
                  Domyślne 2025
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                   <div className="space-y-2">
                     <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prognozowane przeciętne wynagrodzenie</Label>
                     <div className="relative">
                       <Input 
                         type="text"
                         value={formatLocaleAmount(globalSettings.avgSalaryForecast, 0)}
                         onChange={e => actions.updateGlobalSettings({ avgSalaryForecast: parseLocaleAmount(e.target.value) })}
                         className="font-mono pl-8"
                       />
                       <BanknoteIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">zł</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground italic">Podstawa do wyliczania limitu 30-krotności składek ZUS.</p>
                   </div>

                   <div className="space-y-2">
                     <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próg II skali podatkowej (rocznie)</Label>
                     <div className="relative">
                        <Input 
                          type="text"
                          value={formatLocaleAmount(globalSettings.pitThresholdAnnual, 0)}
                          onChange={e => actions.updateGlobalSettings({ pitThresholdAnnual: parseLocaleAmount(e.target.value) })}
                          className="font-mono pl-8"
                        />
                        <Target className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">zł</span>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kwota wolna od podatku (rocznie)</Label>
                     <Input 
                       type="text"
                       value={formatLocaleAmount(globalSettings.taxFreeAmountAnnual, 0)}
                       onChange={e => actions.updateGlobalSettings({ taxFreeAmountAnnual: parseLocaleAmount(e.target.value) })}
                       className="font-mono"
                     />
                   </div>
                 </div>

                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-xs font-bold">Stawka I PIT</Label>
                          <div className="relative">
                             <Input 
                               value={formatLocaleAmount(globalSettings.pitFirstRate)}
                               onChange={e => actions.updateGlobalSettings({ pitFirstRate: parseLocaleAmount(e.target.value) })}
                               className="pr-8 font-mono"
                             />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-xs font-bold">Stawka II PIT</Label>
                          <div className="relative">
                             <Input 
                               value={formatLocaleAmount(globalSettings.pitSecondRate)}
                               onChange={e => actions.updateGlobalSettings({ pitSecondRate: parseLocaleAmount(e.target.value) })}
                               className="pr-8 font-mono"
                             />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                          </div>
                       </div>
                    </div>

                    <Separator className="opacity-50" />

                    <div className="space-y-3 bg-accent/5 p-6 rounded-2xl border border-accent/10">
                       <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck className="w-4 h-4 text-accent" />
                          <Label className="text-xs font-bold uppercase tracking-wider text-accent">Cel poduszki finansowej</Label>
                       </div>
                       <div className="flex items-center gap-4">
                          <Input 
                            type="number"
                            min={1}
                            max={36}
                            value={globalSettings.targetEmergencyFundMonths}
                            onChange={e => actions.updateGlobalSettings({ targetEmergencyFundMonths: Number(e.target.value) })}
                            className="w-20 font-bold"
                          />
                          <span className="text-sm text-muted-foreground">miesięcy wydatków</span>
                       </div>
                       <p className="text-[10px] text-muted-foreground leading-relaxed mt-2 italic">
                         To ustawienie wpłynie na wskaźnik "Poduszka" na pulpicie, pokazując czy Twój zapas gotówki jest wystarczający względem Twojego osobistego celu.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
           <div className="bg-card rounded-[2rem] border border-border p-8 shadow-warm space-y-8">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                    <UserCircle className="w-10 h-10" />
                 </div>
                 <div>
                    <h3 className="font-display text-2xl">Twój Profil</h3>
                    <p className="text-sm text-muted-foreground">{session?.user.email}</p>
                 </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                 <div className="space-y-2">
                    <Label htmlFor="nickname" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Twój Pseudonim / Imię</Label>
                    <Input 
                      id="nickname"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      placeholder="Jak mamy Cię witać?"
                      className="max-w-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">To imię będzie wyświetlane w powitaniu na pulpicie oraz przy Twoich zmianach w historii.</p>
                 </div>

                 <Button type="submit" disabled={isUpdatingProfile} className="rounded-xl px-8">
                    {isUpdatingProfile ? "Aktualizacja..." : "Zapisz profil"}
                 </Button>
              </form>

              <Separator />

              <div className="pt-4 space-y-4">
                 <h4 className="text-sm font-bold">Połączone sesje</h4>
                 <div className="p-4 bg-muted/20 rounded-xl border border-border/40 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <Globe className="w-4 h-4 text-muted-foreground" />
                       <div className="text-xs">
                          <p className="font-bold">Twoje obecne urządzenie</p>
                          <p className="text-muted-foreground">Ostatnia aktywność: Teraz</p>
                       </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-success border-success/30 bg-success/5">Aktywna</Badge>
                 </div>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="data" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid md:grid-cols-2 gap-8">
              {/* Data Export */}
              <div className="bg-card rounded-[2rem] border border-border p-8 shadow-warm space-y-6">
                 <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                    <Download className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-display text-2xl">Eksportuj Dane</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Pobierz kopię zapasową całego gospodarstwa w formacie JSON. Możesz ją wykorzystać do własnych analiz lub jako kopię bezpieczeństwa.
                    </p>
                 </div>
                 <Button variant="outline" onClick={handleExportData} className="w-full rounded-xl gap-2">
                    <Download className="w-4 h-4" /> Eksportuj do pliku
                 </Button>
              </div>

              {/* Danger Zone */}
              <div className="bg-destructive/5 rounded-[2rem] border border-destructive/20 p-8 shadow-sm space-y-6">
                 <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                    <Trash2 className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="font-display text-2xl text-destructive">Strefa Niebezpieczna</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Operacje w tej sekcji są nieodwracalne. Bądź ostrożny.
                    </p>
                 </div>
                 
                 <div className="space-y-3">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => {
                        if(confirm("Czy na pewno chcesz wyczyścić wszystkie dane? Ta operacja usunie zarobki, wydatki i aktywa, ale zachowa członków gospodarstwa.")) {
                           actions.clearAllData();
                           toast.success("Dane zostały wyczyszczone.");
                        }
                      }}
                    >
                       Wyczyść wszystkie dane
                    </Button>
                    {isOwner && (
                      <Button 
                        variant="destructive" 
                        className="w-full rounded-xl gap-2"
                        onClick={handleDeleteHousehold}
                      >
                         <Trash2 className="w-4 h-4" /> Usuń całe gospodarstwo
                      </Button>
                    )}
                 </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

const BanknoteIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
);
