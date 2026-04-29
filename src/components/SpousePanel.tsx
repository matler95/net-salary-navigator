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
import { Trash2, X, ChevronDown, User, Zap, Landmark, BadgePercent, Gift, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useMemo, useState, useEffect, useId, useRef } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
  hint?: React.ReactNode;
}) {
  const [localValue, setLocalValue] = useState<string>(formatLocaleAmount(value));
  const id = useId();

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
      <Label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="0"
          className="pr-12 font-mono tabular-nums text-base h-11"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground font-medium">{hint}</p>}
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
      className={cn(
        "flex items-baseline justify-between gap-4 py-2",
        bold ? "text-base font-bold" : "text-sm",
        muted && "text-muted-foreground"
      )}
    >
      <span className="leading-snug">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums whitespace-nowrap",
          negative && "text-destructive",
          positive && "text-success",
          bold && !negative && !positive && "text-accent"
        )}
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
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex flex-col">
        <Label
          htmlFor={id}
          className="text-sm font-semibold cursor-pointer leading-tight mb-0.5"
        >
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SectionGroup({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  activeIndicator = false,
  summary,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  activeIndicator?: boolean;
  summary?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/col">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-3 transition-colors",
            open ? "bg-accent-soft/40" : "bg-muted/30 hover:bg-muted/50"
          )}
        >
          <div className="flex items-center justify-between flex-1 pr-2">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm">{title}</span>
            </div>
            {!open && summary && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider animate-in fade-in slide-in-from-right-1">
                {summary}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
        <div className="pt-4 px-1 space-y-5 pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
  const baseId = useId();
  const globalSettings = useAppState((s) => s.globalSettings);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const r = useMemo(() => calculateSalary(spouse.inputs, 0, globalSettings), [spouse.inputs, globalSettings]);
  const set = <K extends keyof SalaryInputs>(k: K, v: SalaryInputs[K]) =>
    actions.updateSpouseInputs(spouse.id, { [k]: v } as Partial<SalaryInputs>);

  const filteredMembers = useMemo(() => {
    if (!memberOptions) return [];
    const searchTerm = spouse.name.toLowerCase();
    return memberOptions.filter((m) => m.label.toLowerCase().includes(searchTerm));
  }, [spouse.name, memberOptions]);

  const handleMemberSelect = (memberId: string, memberLabel: string) => {
    actions.updateSpouse(spouse.id, { name: memberLabel, assignedUserId: memberId });
    setShowMemberDropdown(false);
  };

  const handleClearAssignment = () => {
    actions.updateSpouse(spouse.id, { assignedUserId: undefined });
  };

  const annualBreakdown = useMemo(() => calculateAnnualBreakdown(spouse.inputs, globalSettings), [spouse.inputs, globalSettings]);
  const totalAnnualTaxBase = useMemo(() => annualBreakdown.reduce((sum, m) => sum + m.taxBase, 0), [annualBreakdown]);

  const thresholdPct = Math.min((totalAnnualTaxBase / globalSettings.pitThresholdAnnual) * 100, 100);

  const [isAnnual, setIsAnnual] = useState(false);
  const displayGross = isAnnual ? spouse.inputs.gross * 12 : spouse.inputs.gross;
  const setGross = (v: number) => set("gross", isAnnual ? v / 12 : v);

  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : "?";

  const hasBenefits = spouse.inputs.benefitsTaxable > 0 || spouse.inputs.lunchAllowance > 0 || spouse.inputs.remoteAllowance > 0 || spouse.inputs.companyCarEnabled;
  const hasTaxOverrides = spouse.inputs.pit2 || spouse.inputs.outsideFirstThreshold || spouse.inputs.age26Exempt || spouse.inputs.kupType !== "standard" || spouse.inputs.autorskiSharePct > 0;
  const hasPpk = spouse.inputs.ppkEmployeeRate > 0 || spouse.inputs.ppkEmployerRate > 0;
  const hasBonus = spouse.inputs.bonusMonth > 0;

  // Bar proportions
  const totalBase = Math.max(r.gross, 1);
  const pctNet = (r.net / totalBase) * 100;
  const pctZus = (r.zusTotal / totalBase) * 100;
  const pctHealth = (r.health / totalBase) * 100;
  const pctPit = (Math.max(0, r.pit) / totalBase) * 100;
  const pctPpk = (r.ppkEmployee / totalBase) * 100;

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden relative group/panel">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 p-5 bg-warm-gradient border-b border-border">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-xl font-bold italic text-accent-foreground shadow-sm">
            {getInitial(spouse.name)}
          </div>
          <div className="flex-1 relative">
            <Input
              id={`${baseId}-name`}
              value={spouse.name}
              onChange={(e) => {
                actions.updateSpouse(spouse.id, { name: e.target.value });
                setShowMemberDropdown(true);
              }}
              onFocus={() => memberOptions && memberOptions.length > 0 && setShowMemberDropdown(true)}
              placeholder="Imię osoby"
              className="font-display text-3xl font-bold h-12 px-0 bg-transparent border-none rounded-none focus-visible:ring-0 focus-visible:border-none shadow-none text-foreground placeholder:text-muted-foreground/50 w-full"
            />
            {spouse.assignedUserId && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                <User className="w-3 h-3" /> połączono: {memberOptions?.find(m => m.user_id === spouse.assignedUserId)?.label}
                <button onClick={handleClearAssignment} className="ml-1 hover:text-foreground"><X className="w-3 h-3" /></button>
              </span>
            )}
            {showMemberDropdown && memberOptions && memberOptions.length > 0 && filteredMembers.length > 0 && (
              <div ref={dropdownRef} className="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 p-1">
                {filteredMembers.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => handleMemberSelect(member.user_id, member.label)}
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                  >
                    {member.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.removeSpouse(spouse.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Usuń"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="p-5 sm:p-6 grid lg:grid-cols-2 gap-x-8 gap-y-10 items-start">
        {/* 1. PRIMARY INPUT: Wynagrodzenie Brutto */}
        <div className="order-1 space-y-4">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${baseId}-gross`}
              className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer"
            >
              Wynagrodzenie brutto
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-bold uppercase", !isAnnual && "text-accent")}>M-c</span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span className={cn("text-[10px] font-bold uppercase", isAnnual && "text-accent")}>Rok</span>
            </div>
          </div>
          <div className="relative">
            <Input
              id={`${baseId}-gross`}
              type="text"
              inputMode="decimal"
              value={formatLocaleAmount(displayGross)}
              onChange={(e) => setGross(parseLocaleAmount(e.target.value))}
              className="pr-12 font-mono tabular-nums text-2xl h-14 font-bold border-accent/30 focus-visible:ring-accent"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
              zł
            </span>
          </div>
          <div className="pt-2">
            <Slider
              value={[displayGross]}
              min={0}
              max={isAnnual ? 600000 : 50000}
              step={isAnnual ? 1000 : 100}
              onValueChange={([v]) => setGross(v)}
              className="[&>span:first-child]:bg-accent"
            />
          </div>
        </div>

        {/* 2. PRIMARY RESULT: Na rękę */}
        <div className="order-2">
          <div className="rounded-2xl p-6 bg-accent text-accent-foreground shadow-warm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/70">
              Na rękę
            </p>
            <p className="font-display text-5xl mt-2 mb-6 tabular-nums animate-count-up">
              {formatPLN(r.net)}
            </p>
            <div className="grid grid-cols-2 gap-3 border-t border-primary-foreground/15 pt-5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60 mb-1">Brutto</p>
                <p className="font-mono text-sm tabular-nums">{formatPLN(r.gross)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60 mb-1">Koszt pracodawcy</p>
                <p className="font-mono text-sm tabular-nums">{formatPLN(r.totalEmployerCost)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. SECONDARY INPUTS: Collapsibles */}
        <div className="order-3 space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <Separator className="flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Szczegóły</span>
            <Separator className="flex-1" />
          </div>

          <SectionGroup
            title="Benefity i dodatki"
            icon={Gift}
            activeIndicator={hasBenefits}
            summary={hasBenefits ? formatPLN(spouse.inputs.benefitsTaxable + spouse.inputs.lunchAllowance + spouse.inputs.remoteAllowance + (spouse.inputs.companyCarEnabled ? (spouse.inputs.companyCarMode === "statutory" ? parseInt(spouse.inputs.companyCarStatutoryValue) : spouse.inputs.companyCarManualAmount) : 0)) : null}
          >
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Benefity (LuxMed, sport)"
                value={spouse.inputs.benefitsTaxable}
                onChange={(n) => set("benefitsTaxable", n)}
              />
              <NumberField
                label="Bony żywieniowe"
                value={spouse.inputs.lunchAllowance}
                onChange={(n) => set("lunchAllowance", n)}
                hint={<span className="text-success inline-flex items-center gap-1 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-success" /> ZUS-free do 450 zł</span>}
              />
            </div>
            <NumberField
              label="Praca zdalna (razem)"
              value={spouse.inputs.remoteAllowance}
              onChange={(n) => set("remoteAllowance", n)}
              hint={<span className="text-success inline-flex items-center gap-1 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-success" /> PIT/ZUS-free</span>}
            />
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <ToggleRow
                label="Samochód służbowy (prywatnie)"
                hint="Przychód opodatkowany i oskładkowany"
                checked={spouse.inputs.companyCarEnabled}
                onChange={(v) => set("companyCarEnabled", v)}
              />
              {spouse.inputs.companyCarEnabled && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Wycena świadczenia
                    </Label>
                    <Select
                      value={spouse.inputs.companyCarMode}
                      onValueChange={(v) => set("companyCarMode", v as SalaryInputs["companyCarMode"])}
                    >
                      <SelectTrigger className="h-11 mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="statutory">Ryczałt ustawowy</SelectItem>
                        <SelectItem value="manual">Kwota ręczna</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {spouse.inputs.companyCarMode === "statutory" ? (
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Ryczałt miesięczny
                      </Label>
                      <Select
                        value={spouse.inputs.companyCarStatutoryValue}
                        onValueChange={(v) => set("companyCarStatutoryValue", v as SalaryInputs["companyCarStatutoryValue"])}
                      >
                        <SelectTrigger className="h-11 mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="250">250 zł (do 60 kW / EV / wodór)</SelectItem>
                          <SelectItem value="400">400 zł (pozostałe pojazdy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <NumberField
                      label="Kwota przychodu (miesięcznie)"
                      value={spouse.inputs.companyCarManualAmount}
                      onChange={(n) => set("companyCarManualAmount", n)}
                    />
                  )}
                </div>
              )}
            </div>
          </SectionGroup>

          <SectionGroup title="Ustawienia podatkowe" icon={Landmark} activeIndicator={hasTaxOverrides}>
            <ToggleRow
              label="PIT-2 złożone"
              hint="Kwota wolna 300 zł / m-c"
              checked={spouse.inputs.pit2}
              onChange={(v) => set("pit2", v)}
            />
            <ToggleRow
              label="Powyżej II progu"
              hint="Cały dochód po 32%"
              checked={spouse.inputs.outsideFirstThreshold}
              onChange={(v) => set("outsideFirstThreshold", v)}
            />
            <ToggleRow
              label="Ulga dla młodych (<26 lat)"
              checked={spouse.inputs.age26Exempt}
              onChange={(v) => set("age26Exempt", v)}
            />
            <div className="pt-2">
              <Label
                htmlFor={`${baseId}-kup`}
                className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer"
              >
                Koszty Uzyskania Przychodu (KUP)
              </Label>
              <Select
                value={spouse.inputs.kupType}
                onValueChange={(v) => set("kupType", v as SalaryInputs["kupType"])}
              >
                <SelectTrigger id={`${baseId}-kup`} className="h-11 mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standardowe (250 zł)</SelectItem>
                  <SelectItem value="outOfTown">Podwyższone (300 zł)</SelectItem>
                  <SelectItem value="none">Brak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-accent-soft/30 rounded-xl p-4 border border-accent/20 mt-4">
              <ToggleRow
                label="Autorskie KUP (50%)"
                hint="Dla twórców IT/artystów."
                checked={spouse.inputs.autorskiSharePct > 0}
                onChange={(v) => set("autorskiSharePct", v ? 80 : 0)}
              />
              {spouse.inputs.autorskiSharePct > 0 && (
                <div className="pt-4 mt-2 border-t border-accent/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Udział w wynagrodzeniu
                    </Label>
                    <span className="text-sm font-mono font-bold text-accent">
                      {spouse.inputs.autorskiSharePct}%
                    </span>
                  </div>
                  <Slider
                    value={[spouse.inputs.autorskiSharePct]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => set("autorskiSharePct", v)}
                    className="[&>span:first-child]:bg-accent"
                  />
                  {r.kupAutorski > 0 && (
                    <p className="text-[11px] text-accent font-medium mt-2">
                      Zysk z odliczenia: {formatPLN2(r.kupAutorski)} / m-c
                    </p>
                  )}
                </div>
              )}
            </div>
          </SectionGroup>

          <SectionGroup
            title="PPK"
            icon={PiggyBank}
            activeIndicator={hasPpk}
            summary={hasPpk ? `${spouse.inputs.ppkEmployeeRate}% / ${spouse.inputs.ppkEmployerRate}%` : null}
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Pracownik
                  </Label>
                  <span className="text-sm font-mono font-bold">{spouse.inputs.ppkEmployeeRate.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[spouse.inputs.ppkEmployeeRate]}
                  min={0}
                  max={4}
                  step={0.1}
                  onValueChange={([v]) => set("ppkEmployeeRate", v)}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Pracodawca
                  </Label>
                  <span className="text-sm font-mono font-bold">{spouse.inputs.ppkEmployerRate.toFixed(1)}%</span>
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
          </SectionGroup>

          <SectionGroup
            title="Premia i Bonusy"
            icon={Zap}
            activeIndicator={hasBonus}
            summary={hasBonus ? formatPLN(spouse.inputs.bonusOverrideGross ?? (spouse.inputs.gross * 12 * (spouse.inputs.bonusPct / 100))) : null}
          >
            <ToggleRow
              label="Dodaj premię roczną"
              hint="Zostanie doliczona do dochodu w wybranym miesiącu"
              checked={spouse.inputs.bonusMonth > 0}
              onChange={(v) => set("bonusMonth", v ? 3 : 0)}
            />
            {spouse.inputs.bonusMonth > 0 && (
              <div className="space-y-5 pt-4 mt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Miesiąc wypłaty</Label>
                    <Select
                      value={String(spouse.inputs.bonusMonth)}
                      onValueChange={(v) => set("bonusMonth", parseInt(v))}
                    >
                      <SelectTrigger className="h-11 mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"][m - 1]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumberField
                    label="Bonus % roczny"
                    value={spouse.inputs.bonusPct}
                    onChange={(v) => set("bonusPct", v)}
                    suffix="%"
                    hint="np. 8% z rocznej podstawy"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                  <div className="space-y-1 pr-4">
                    <Label className="text-sm font-semibold cursor-pointer" onClick={() => set("bonusOverrideGross", spouse.inputs.bonusOverrideGross === null ? (spouse.inputs.gross * 12 * (spouse.inputs.bonusPct / 100)) : null)}>
                      Oblicz z rocznej podstawy
                    </Label>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {spouse.inputs.bonusOverrideGross === null
                        ? `Obliczono: ${formatPLN(spouse.inputs.gross * 12 * (spouse.inputs.bonusPct / 100))}`
                        : "Podajesz kwotę ręcznie poniżej"}
                    </p>
                  </div>
                  <Switch
                    checked={spouse.inputs.bonusOverrideGross === null}
                    onCheckedChange={(v) => set("bonusOverrideGross", v ? null : (spouse.inputs.gross * 12 * (spouse.inputs.bonusPct / 100)))}
                  />
                </div>

                {spouse.inputs.bonusOverrideGross !== null && (
                  <NumberField
                    label="Kwota premii (brutto)"
                    value={spouse.inputs.bonusOverrideGross}
                    onChange={(v) => set("bonusOverrideGross", v)}
                  />
                )}

                <div className="flex items-center justify-between p-4 bg-success/10 rounded-xl border border-success/20">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 w-2 h-2 rounded-full", spouse.inputs.bonusPaid ? "bg-success" : "bg-muted-foreground")} />
                    <div>
                      <Label className="text-sm font-semibold cursor-pointer" onClick={() => set("bonusPaid", !spouse.inputs.bonusPaid)}>
                        Uwzględniaj w skali rocznej
                      </Label>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                        Zaznacz by poprawnie wyliczyć drugi próg
                      </p>
                    </div>
                  </div>
                  <Switch checked={spouse.inputs.bonusPaid} onCheckedChange={(v) => set("bonusPaid", v)} />
                </div>
              </div>
            )}
          </SectionGroup>
        </div>

        {/* 4. SECONDARY RESULTS: Breakdown & Banner */}
        <div className="order-4 space-y-6">
          {/* Breakdown Visualization */}
          <div className="bg-muted/40 rounded-2xl p-5 border border-border">
            <Collapsible
              defaultOpen={false}
              className="space-y-3"
            >
              <CollapsibleTrigger className="w-full text-left group/trigger">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/trigger:text-foreground transition-colors">
                    Podział pensji
                  </p>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-hover/trigger:text-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                </div>
                <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted border border-border shadow-inner">
                  <div style={{ width: `${pctNet}%` }} className="bg-success transition-all duration-500" title="Netto" />
                  <div style={{ width: `${pctZus}%` }} className="bg-[var(--zus)] transition-all duration-500" title="ZUS" />
                  <div style={{ width: `${pctHealth}%` }} className="bg-[var(--health)] transition-all duration-500" title="Zdrowotna" />
                  <div style={{ width: `${pctPit}%` }} className="bg-destructive transition-all duration-500" title="PIT" />
                  {pctPpk > 0 && <div style={{ width: `${pctPpk}%` }} className="bg-[var(--ppk)] transition-all duration-500" title="PPK" />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] uppercase font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success" /> Netto ({pctNet.toFixed(1)}%)</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--zus)]" /> ZUS ({pctZus.toFixed(1)}%)</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--health)]" /> Zdrow. ({pctHealth.toFixed(1)}%)</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /> PIT ({pctPit.toFixed(1)}%)</span>
                  {pctPpk > 0 && <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--ppk)]" /> PPK</span>}
                </div>

              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 pt-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
                <div className="space-y-1">
                  <Row label="Brutto" value={r.gross} muted />
                  {r.companyCarTaxable > 0 && <Row label="Samochód służbowy (przychód)" value={r.companyCarTaxable} muted />}
                  <Row label="ZUS (suma)" value={-r.zusTotal} negative />
                  <Row label="Zdrowotna 9%" value={-r.health} negative />
                  {r.ppkEmployee > 0 && <Row label="PPK pracownik" value={-r.ppkEmployee} negative />}
                  <Row label="KUP (standardowe)" value={r.kupStandard} muted />
                  {r.kupAutorski > 0 && <Row label="KUP autorskie 50%" value={r.kupAutorski} positive />}
                  <Row label="Zaliczka PIT" value={-r.pit} negative />
                  <Separator className="my-2 opacity-60" />
                  <div className="rounded-xl bg-accent-soft p-3 mt-2 border border-accent/20">
                    <Row label="Do wypłaty netto" value={r.net} bold />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Tax Threshold Banner */}
          {!spouse.inputs.outsideFirstThreshold && (
            <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Limit II progu (120k zł)
                </span>
                <span className="text-xs font-bold font-mono">
                  {thresholdPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-1000",
                    thresholdPct < 70 ? "bg-success" : thresholdPct < 95 ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${thresholdPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center font-medium">
                {thresholdPct >= 100
                  ? "Przekroczono II próg podatkowy!"
                  : `Pozostało ${formatPLN(120000 - totalAnnualTaxBase)} do limitu w tym roku.`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
