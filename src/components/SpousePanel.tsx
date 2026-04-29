import {
  calculateSalary,
  calculateAnnualBreakdown,
  formatPLN,
  formatPLN2,
  parseLocaleAmount,
  formatLocaleAmount,
  type SalaryInputs,
} from "@/lib/salary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { actions, type Spouse, useAppState } from "@/lib/store";
import {
  Trash2,
  X,
  Banknote,
  Briefcase,
  Car,
  GraduationCap,
  User,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function NumberField({
  label,
  value,
  onChange,
  suffix = "zł",
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
}) {
  const [localValue, setLocalValue] = useState<string>(formatLocaleAmount(value));

  useEffect(() => {
    const parsedLocal = parseLocaleAmount(localValue);
    if (parsedLocal !== value) {
      setLocalValue(formatLocaleAmount(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    const parsed = parseLocaleAmount(raw);
    onChange(parsed);
  };

  const handleBlur = () => {
    setLocalValue(formatLocaleAmount(value));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        {label}
      </Label>
      <div className="relative group">
        <Input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="0"
          className="pr-12 font-mono tabular-nums text-base h-12 bg-background/50 border-border/50 group-hover:border-border focus:border-accent transition-all rounded-xl"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/50 group-focus-within:text-accent transition-colors">
          {suffix}
        </span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground italic px-1">{hint}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-[1rem] bg-accent-soft flex items-center justify-center text-accent shrink-0 shadow-sm border border-accent/10">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground/80 leading-relaxed">{desc}</p>}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
  positive,
  muted,
}: {
  label: React.ReactNode;
  value: number;
  bold?: boolean;
  negative?: boolean;
  positive?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 border-b border-border/20 last:border-0 ${
        bold ? "text-base font-bold" : "text-sm"
      } ${muted ? "text-muted-foreground font-medium" : "text-foreground font-medium"}`}
    >
      <span className="leading-snug">{label}</span>
      <span
        className={`font-mono tabular-nums whitespace-nowrap ${
          negative ? "text-destructive" : positive ? "text-success" : ""
        }`}
      >
        {`${negative ? "−" : ""}${formatPLN2(Math.abs(value))}`}
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: any;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 group">
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
        )}
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SpousePanel({
  spouse,
  canDelete,
  memberOptions,
}: {
  spouse: Spouse;
  canDelete: boolean;
  memberOptions?: { user_id: string; label: string }[];
}) {
  const globalSettings = useAppState((s) => s.globalSettings);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const r = useMemo(
    () => calculateSalary(spouse.inputs, 0, globalSettings),
    [spouse.inputs, globalSettings],
  );
  const set = <K extends keyof SalaryInputs>(k: K, v: SalaryInputs[K]) =>
    actions.updateSpouseInputs(spouse.id, { [k]: v } as Partial<SalaryInputs>);

  const filteredMembers = useMemo(() => {
    if (!memberOptions) return [];
    const searchTerm = spouse.name.toLowerCase();
    return memberOptions.filter((m) => m.label.toLowerCase().includes(searchTerm));
  }, [spouse.name, memberOptions]);

  const handleMemberSelect = (memberId: string, memberLabel: string) => {
    actions.updateSpouse(spouse.id, {
      name: memberLabel,
      assignedUserId: memberId,
    });
    setShowMemberDropdown(false);
  };

  const handleClearAssignment = () => {
    actions.updateSpouse(spouse.id, { assignedUserId: undefined });
  };

  const annualBreakdown = useMemo(
    () => calculateAnnualBreakdown(spouse.inputs, globalSettings),
    [spouse.inputs, globalSettings],
  );
  const totalAnnualTaxBase = useMemo(
    () => annualBreakdown.reduce((sum, m) => sum + m.taxBase, 0),
    [annualBreakdown],
  );

  const monthsToSecondThreshold = useMemo(() => {
    let cumulative = 0;
    const threshold = globalSettings.pitThresholdAnnual;
    for (let m = 1; m <= 12; m++) {
      const monthBase = annualBreakdown[m - 1].taxBase;
      if (cumulative < threshold && cumulative + monthBase > threshold) return m;
      cumulative += monthBase;
    }
    return cumulative > threshold ? 12 : null;
  }, [annualBreakdown, globalSettings.pitThresholdAnnual]);

  return (
    <div className="bg-card rounded-[2rem] border border-border shadow-warm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Name / Member Header */}
      <div className="p-6 border-b border-border bg-background/30 flex items-center justify-between gap-4">
        <div className="flex-1 relative max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-accent-soft">
              {spouse.name[0].toUpperCase()}
            </div>
            <div className="flex-1 relative">
              <Input
                value={spouse.name}
                onChange={(e) => {
                  actions.updateSpouse(spouse.id, { name: e.target.value });
                  setShowMemberDropdown(true);
                }}
                onFocus={() =>
                  memberOptions && memberOptions.length > 0 && setShowMemberDropdown(true)
                }
                placeholder="Imię lub wybierz członka"
                className="font-display text-xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0 shadow-none hover:text-accent transition-colors"
              />
              {spouse.assignedUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAssignment}
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                {spouse.assignedUserId ? "Zsynchronizowany profil" : "Profil lokalny"}
              </div>
            </div>
          </div>

          {showMemberDropdown &&
            memberOptions &&
            memberOptions.length > 0 &&
            filteredMembers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-card border border-border rounded-2xl shadow-xl z-50 p-1 animate-in zoom-in-95 duration-200">
                {filteredMembers.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() => handleMemberSelect(member.user_id, member.label)}
                    className={`w-full text-left px-4 py-2.5 text-sm rounded-xl hover:bg-accent-soft hover:text-accent transition-all ${
                      spouse.assignedUserId === member.user_id
                        ? "bg-accent-soft text-accent font-bold"
                        : "font-medium"
                    }`}
                  >
                    {member.label}
                  </button>
                ))}
              </div>
            )}
        </div>

        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.removeSpouse(spouse.id)}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="p-6 sm:p-8 grid lg:grid-cols-2 gap-10">
        {/* Left Side: Inputs */}
        <div className="space-y-10">
          {/* Main Salary Section */}
          <div className="space-y-6">
            <SectionHeader
              icon={Banknote}
              title="Wynagrodzenie Główne"
              desc="Podstawowe parametry Twojej umowy o pracę (UoP)."
            />

            <div className="space-y-8">
              <NumberField
                label="Miesięczne Brutto"
                value={spouse.inputs.gross}
                onChange={(n) => set("gross", n)}
              />
              <Slider
                value={[spouse.inputs.gross]}
                min={0}
                max={50000}
                step={100}
                onValueChange={([v]) => set("gross", v)}
                className="mx-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <NumberField
                label="Prywatne Benefity"
                value={spouse.inputs.benefitsTaxable}
                onChange={(n) => set("benefitsTaxable", n)}
                hint="LuxMed, MultiSport itp."
              />
              <NumberField
                label="Bony Żywieniowe"
                value={spouse.inputs.lunchAllowance}
                onChange={(n) => set("lunchAllowance", n)}
                hint="ZUS-free do 450 zł"
              />
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Company Car Section */}
          <div className="space-y-6">
            <SectionHeader
              icon={Car}
              title="Samochód Służbowy"
              desc="Jeśli używasz auta firmowego do celów prywatnych."
            />

            <div className="bg-background/40 rounded-3xl p-5 border border-border/50 space-y-4">
              <ToggleRow
                label="Aktywuj ryczałt"
                hint="Dolicza przychód do opodatkowania"
                checked={spouse.inputs.companyCarEnabled}
                onChange={(v) => set("companyCarEnabled", v)}
              />

              {spouse.inputs.companyCarEnabled && (
                <div className="grid gap-4 pt-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                        Typ Wyceny
                      </Label>
                      <Select
                        value={spouse.inputs.companyCarMode}
                        onValueChange={(v) =>
                          set("companyCarMode", v as SalaryInputs["companyCarMode"])
                        }
                      >
                        <SelectTrigger className="rounded-xl border-border/50 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="statutory">Ustawowy</SelectItem>
                          <SelectItem value="manual">Własny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {spouse.inputs.companyCarMode === "statutory" ? (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          Moc / Napęd
                        </Label>
                        <Select
                          value={spouse.inputs.companyCarStatutoryValue}
                          onValueChange={(v) =>
                            set(
                              "companyCarStatutoryValue",
                              v as SalaryInputs["companyCarStatutoryValue"],
                            )
                          }
                        >
                          <SelectTrigger className="rounded-xl border-border/50 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="250">Do 60kW / EV</SelectItem>
                            <SelectItem value="400">Standard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <NumberField
                        label="Kwota Mies."
                        value={spouse.inputs.companyCarManualAmount}
                        onChange={(n) => set("companyCarManualAmount", n)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced / Taxes Toggle */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Parametry Podatkowe & PPK
                </h3>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg">
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="space-y-6 pt-2 animate-in slide-in-from-top-4 duration-300">
              {/* PPK Rates */}
              <div className="grid grid-cols-2 gap-8 bg-background/40 p-6 rounded-[2rem] border border-border/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">
                      PPK Pracownik
                    </Label>
                    <span className="text-xs font-mono font-bold text-accent">
                      {spouse.inputs.ppkEmployeeRate}%
                    </span>
                  </div>
                  <Slider
                    value={[spouse.inputs.ppkEmployeeRate]}
                    min={0}
                    max={4}
                    step={0.1}
                    onValueChange={([v]) => set("ppkEmployeeRate", v)}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">
                      PPK Pracodawca
                    </Label>
                    <span className="text-xs font-mono font-bold text-accent">
                      {spouse.inputs.ppkEmployerRate}%
                    </span>
                  </div>
                  <Slider
                    value={[spouse.inputs.ppkEmployerRate]}
                    min={0}
                    max={4}
                    step={0.1}
                    onValueChange={([v]) => set("ppkEmployerRate", v)}
                  />
                </div>
              </div>

              {/* Tax Options Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-[1.5rem] bg-background/40 border border-border/50">
                  <ToggleRow
                    label="PIT-2"
                    hint="Kwota wolna 300 zł/mc"
                    checked={spouse.inputs.pit2}
                    onChange={(v) => set("pit2", v)}
                  />
                </div>
                <div className="p-4 rounded-[1.5rem] bg-background/40 border border-border/50">
                  <ToggleRow
                    label="Ulga <26 lat"
                    checked={spouse.inputs.age26Exempt}
                    onChange={(v) => set("age26Exempt", v)}
                  />
                </div>
                <div className="p-4 rounded-[1.5rem] bg-background/40 border border-border/50 sm:col-span-2">
                  <ToggleRow
                    label="Autorskie KUP (50%)"
                    hint="Honorarium autorskie dla twórców"
                    checked={spouse.inputs.autorskiSharePct > 0}
                    onChange={(v) => set("autorskiSharePct", v ? 80 : 0)}
                    icon={GraduationCap}
                  />
                  {spouse.inputs.autorskiSharePct > 0 && (
                    <div className="pt-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">
                          Udział w pensji
                        </span>
                        <span className="text-xs font-bold text-accent">
                          {spouse.inputs.autorskiSharePct}%
                        </span>
                      </div>
                      <Slider
                        value={[spouse.inputs.autorskiSharePct]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([v]) => set("autorskiSharePct", v)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Bonus Section */}
          <div className="bg-success/5 rounded-[2.5rem] p-8 border border-success/20 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <TrendingUp className="w-16 h-16 text-success" />
            </div>
            <SectionHeader
              icon={TrendingUp}
              title="Premia & Bonusy"
              desc="Dodatkowe wpływy roczne lub kwartalne."
            />

            <ToggleRow
              label="Uwzględnij premię"
              checked={spouse.inputs.bonusMonth > 0}
              onChange={(v) => set("bonusMonth", v ? 3 : 0)}
            />

            {spouse.inputs.bonusMonth > 0 && (
              <div className="grid gap-6 pt-4 border-t border-success/10 animate-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Miesiąc wypłaty
                    </Label>
                    <Select
                      value={String(spouse.inputs.bonusMonth)}
                      onValueChange={(v) => set("bonusMonth", parseInt(v))}
                    >
                      <SelectTrigger className="rounded-xl border-success/20 h-11 bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {monthLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumberField
                    label="Wartość % Rocznie"
                    value={spouse.inputs.bonusPct}
                    onChange={(v) => set("bonusPct", v)}
                    suffix="%"
                  />
                </div>

                <div className="bg-success-soft/30 p-4 rounded-2xl border border-success/10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-success-foreground">
                      Obliczaj automatycznie?
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Na podstawie % i rocznej pensji
                    </p>
                  </div>
                  <Switch
                    checked={spouse.inputs.bonusOverrideGross === null}
                    onCheckedChange={(v) =>
                      set(
                        "bonusOverrideGross",
                        v ? null : spouse.inputs.gross * 12 * (spouse.inputs.bonusPct / 100),
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Results & Breakdown */}
        <div className="space-y-6">
          <div className="sticky top-8 space-y-6">
            {/* Main Result Card */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-foreground p-8 shadow-2xl group animate-in zoom-in-95 duration-700">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-accent/30 transition-all duration-1000" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-success/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center text-center py-6">
                <div className="flex items-center gap-2 text-background/60 font-bold text-[10px] uppercase tracking-[0.3em] mb-4">
                  <Zap className="w-3 h-3 fill-accent text-accent" /> Wynagrodzenie Netto
                </div>
                <div className="font-display text-5xl sm:text-6xl font-bold text-background tabular-nums mb-4 drop-shadow-sm">
                  {formatPLN2(r.net)}
                </div>
                <div className="bg-background/10 backdrop-blur-md px-4 py-2 rounded-full border border-background/20 text-background/80 text-xs font-bold flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Średnio co miesiąc
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-4 mt-12 pt-8 border-t border-background/10">
                <div>
                  <p className="text-[10px] font-bold text-background/40 uppercase tracking-widest mb-1">
                    Brutto
                  </p>
                  <p className="text-background font-mono font-bold">{formatPLN2(r.gross)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-background/40 uppercase tracking-widest mb-1">
                    Koszt Pracodawcy
                  </p>
                  <p className="text-background font-mono font-bold">
                    {formatPLN2(r.totalEmployerCost)}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-warm">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
                <ChevronDown className="w-3.5 h-3.5" /> Składniki & Odliczenia
              </h4>
              <div className="space-y-1">
                <Row label="Przychód Brutto" value={r.gross} muted />
                {r.companyCarTaxable > 0 && (
                  <Row label="Użytek auta (przychód)" value={r.companyCarTaxable} muted />
                )}
                <div className="h-4" />
                <Row
                  label={
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive" /> ZUS
                      (Emeryt/Rent/Chor)
                    </div>
                  }
                  value={-r.zusTotal}
                  negative
                />
                <Row
                  label={
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Zdrowotna 9%
                    </div>
                  }
                  value={-r.health}
                  negative
                />
                {r.ppkEmployee > 0 && (
                  <Row
                    label={
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> PPK Pracownik
                      </div>
                    }
                    value={-r.ppkEmployee}
                    negative
                  />
                )}
                <Row
                  label={
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" /> Zaliczka na PIT
                    </div>
                  }
                  value={-r.pit}
                  negative
                />
                <div className="h-4" />
                {r.kupAutorski > 0 && <Row label="Odpis KUP 50%" value={r.kupAutorski} positive />}
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold">Wypłata Netto</span>
                  <span className="font-display text-2xl font-bold text-accent">
                    {formatPLN2(r.net)}
                  </span>
                </div>
              </div>
            </div>

            {/* Threshold Warning */}
            {!spouse.inputs.outsideFirstThreshold && monthsToSecondThreshold && (
              <div className="bg-warning-soft/30 border border-warning/20 rounded-[2rem] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Zap className="w-12 h-12 text-warning" />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-warning-foreground mb-2">
                    Drugi Próg Podatkowy (32%)
                  </p>
                  <p className="text-sm font-semibold leading-relaxed">
                    Przekroczysz limit 120k w{" "}
                    <span className="text-warning-foreground underline decoration-warning/30 underline-offset-4">
                      {monthsToSecondThreshold >= 12
                        ? "grudniu"
                        : monthIndexToName(monthsToSecondThreshold)}
                    </span>
                    .
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, (totalAnnualTaxBase / 120000) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground whitespace-nowrap">
                      {Math.round((totalAnnualTaxBase / 120000) * 100)}% limitu
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function monthLabel(m: number): string {
  const names = [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ];
  return names[m - 1];
}

function monthIndexToName(month: number): string {
  const names = [
    "styczniu",
    "lutym",
    "marcu",
    "kwietniu",
    "maju",
    "czerwcu",
    "lipcu",
    "sierpniu",
    "wrześniu",
    "październiku",
    "listopadzie",
    "grudniu",
  ];
  return names[Math.min(11, Math.max(0, month - 1))];
}
