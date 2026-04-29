import {
  calculateSalary,
  calculateB2B,
  formatPLN,
  formatPLN2,
  parseLocaleAmount,
  formatLocaleAmount,
  type SalaryInputs,
  type B2BInputs,
  type Income,
  type IncomeType,
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
import { actions, useAppState } from "@/lib/store";
import { Trash2, ChevronDown, Landmark, BadgePercent, Gift, PiggyBank, Briefcase, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useMemo, useState, useEffect, useId } from "react";
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
  summary,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
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

interface IncomePanelProps {
  spouseId: string;
  income: Income;
}

export function IncomePanel({ spouseId, income }: IncomePanelProps) {
  const settings = useAppState((s) => s.settings);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateUoP = (patch: Partial<SalaryInputs>) => {
    actions.updateSpouseIncome(spouseId, income.id, {
      uopInputs: { ...income.uopInputs!, ...patch },
    });
  };

  const updateB2B = (patch: Partial<B2BInputs>) => {
    actions.updateSpouseIncome(spouseId, income.id, {
      b2bInputs: { ...income.b2bInputs!, ...patch },
    });
  };

  const uopBreakdown = useMemo(() => {
    if (income.type !== "UoP" || !income.uopInputs) return null;
    return calculateSalary(income.uopInputs, 0, settings);
  }, [income.uopInputs, settings]);

  const b2bBreakdown = useMemo(() => {
    if (income.type !== "B2B" || !income.b2bInputs) return null;
    return calculateB2B(income.b2bInputs, 0, settings);
  }, [income.b2bInputs, settings]);

  const mainValue = income.type === "UoP" ? income.uopInputs?.gross : income.b2bInputs?.revenueNet;
  const netValue = income.type === "UoP" ? uopBreakdown?.net : b2bBreakdown?.net;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div 
        className={cn(
          "px-4 py-3 flex items-center justify-between cursor-pointer group hover:bg-muted/50 transition-colors",
          !isExpanded && "bg-muted/20"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            {income.type === "UoP" ? <Briefcase className="h-4 w-4 text-accent" /> : <Calculator className="h-4 w-4 text-accent" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
               <h4 className="font-bold text-sm leading-none">{income.label}</h4>
               <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-bold text-muted-foreground uppercase">{income.type}</span>
            </div>
            {!isExpanded && (
               <p className="text-xs text-muted-foreground mt-1">
                 {formatPLN(mainValue || 0)} brutto / <span className="text-success font-semibold">{formatPLN(netValue || 0)} netto</span>
               </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              actions.removeIncome(spouseId, income.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
        </div>
      </div>

      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <div className="p-4 pt-2 border-t border-border space-y-6">
            {/* Common Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nazwa kontraktu</Label>
                <Input 
                  value={income.label} 
                  onChange={(e) => actions.updateSpouseIncome(spouseId, income.id, { label: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Typ umowy</Label>
                <Select 
                  value={income.type} 
                  onValueChange={(val: IncomeType) => actions.updateSpouseIncome(spouseId, income.id, { type: val })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UoP">Umowa o pracę</SelectItem>
                    <SelectItem value="B2B">Kontrakt B2B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {income.type === "UoP" && income.uopInputs && (
              <div className="space-y-6">
                <SectionGroup title="Wynagrodzenie i ZUS" icon={Landmark} defaultOpen summary={formatPLN(income.uopInputs.gross)}>
                  <NumberField
                    label="Wynagrodzenie brutto"
                    value={income.uopInputs.gross}
                    onChange={(v) => updateUoP({ gross: v })}
                    hint="Podstawa miesięczna z umowy"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label="Dodatki opodatkowane"
                      value={income.uopInputs.benefitsTaxable}
                      onChange={(v) => updateUoP({ benefitsTaxable: v })}
                    />
                    <NumberField
                      label="Diety / Lunch"
                      value={income.uopInputs.lunchAllowance}
                      onChange={(v) => updateUoP({ lunchAllowance: v })}
                    />
                  </div>
                  <div className="space-y-4 rounded-xl bg-muted/30 p-4">
                    <ToggleRow
                      label="PIT-2"
                      checked={income.uopInputs.pit2}
                      onChange={(v) => updateUoP({ pit2: v })}
                      hint="Kwota wolna od podatku"
                    />
                    <ToggleRow
                      label="Młody do 26 lat"
                      checked={income.uopInputs.age26Exempt}
                      onChange={(v) => updateUoP({ age26Exempt: v })}
                    />
                  </div>
                </SectionGroup>

                <SectionGroup title="Praca twórcza i KUP" icon={BadgePercent}>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Udział autorski: {income.uopInputs.autorskiSharePct}%
                        </Label>
                      </div>
                      <Slider
                        value={[income.uopInputs.autorskiSharePct]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([v]) => updateUoP({ autorskiSharePct: v })}
                        className="py-2"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Część wynagrodzenia z 50% kosztami uzyskania przychodu.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Koszty uzyskania (Standard)
                      </Label>
                      <Select
                        value={income.uopInputs.kupType}
                        onValueChange={(v: any) => updateUoP({ kupType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Miejscowe (250 zł)</SelectItem>
                          <SelectItem value="outOfTown">Dojazdowe (300 zł)</SelectItem>
                          <SelectItem value="none">Brak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SectionGroup>

                <SectionGroup title="PPK" icon={PiggyBank}>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      label="Wpłata pracownika %"
                      value={income.uopInputs.ppkEmployeeRate}
                      onChange={(v) => updateUoP({ ppkEmployeeRate: v })}
                      suffix="%"
                    />
                    <NumberField
                      label="Wpłata pracodawcy %"
                      value={income.uopInputs.ppkEmployerRate}
                      onChange={(v) => updateUoP({ ppkEmployerRate: v })}
                      suffix="%"
                    />
                  </div>
                </SectionGroup>

                <div className="rounded-2xl bg-accent-soft/30 p-4 border border-accent-soft">
                  <h5 className="font-bold text-xs uppercase tracking-widest text-accent mb-3">Podsumowanie miesięczne (UoP)</h5>
                  <div className="divide-y divide-accent-soft/20">
                    <Row label="ZUS (Emerytalna, Rentowa, Chorobowa)" value={uopBreakdown?.zusTotal || 0} negative />
                    <Row label="Ubezpieczenie zdrowotne" value={uopBreakdown?.health || 0} negative />
                    <Row label="Zaliczka na podatek (PIT)" value={uopBreakdown?.pit || 0} negative />
                    <Row label="Wpłata na PPK" value={uopBreakdown?.ppkEmployee || 0} negative />
                    <div className="pt-2 mt-2">
                      <Row label="Wypłata Netto" value={uopBreakdown?.net || 0} bold positive />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {income.type === "B2B" && income.b2bInputs && (
              <div className="space-y-6">
                <SectionGroup title="Przychody i Koszty" icon={Landmark} defaultOpen summary={formatPLN(income.b2bInputs.revenueNet)}>
                  <NumberField
                    label="Przychód netto (faktura)"
                    value={income.b2bInputs.revenueNet}
                    onChange={(v) => updateB2B({ revenueNet: v })}
                  />
                  <NumberField
                    label="Koszty prowadzenia działalności"
                    value={income.b2bInputs.expensesNet}
                    onChange={(v) => updateB2B({ expensesNet: v })}
                    hint="Paliwo, biuro, sprzęt netto"
                  />
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Stawka VAT</Label>
                    <Select 
                      value={income.b2bInputs.vatRate.toString()} 
                      onValueChange={(v) => updateB2B({ vatRate: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="23">23% (Standard)</SelectItem>
                        <SelectItem value="8">8%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="0">0% / zwolniony</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SectionGroup>

                <SectionGroup title="Forma opodatkowania" icon={BadgePercent}>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Typ podatku</Label>
                      <Select 
                        value={income.b2bInputs.taxType} 
                        onValueChange={(v: any) => updateB2B({ taxType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ryczalt">Ryczałt ewidencjonowany</SelectItem>
                          <SelectItem value="liniowy">Podatek liniowy (19%)</SelectItem>
                          <SelectItem value="skala">Skala podatkowa (12%/32%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {income.b2bInputs.taxType === "ryczalt" && (
                       <NumberField
                        label="Stawka ryczałtu"
                        value={income.b2bInputs.ryczaltRate}
                        onChange={(v) => updateB2B({ ryczaltRate: v })}
                        suffix="%"
                        hint="Np. 12% dla IT, 8.5% usługi"
                      />
                    )}
                  </div>
                </SectionGroup>

                <SectionGroup title="ZUS i Składki" icon={PiggyBank}>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ulga ZUS</Label>
                      <Select 
                        value={income.b2bInputs.zusType} 
                        onValueChange={(v: any) => updateB2B({ zusType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Duży ZUS (Standard)</SelectItem>
                          <SelectItem value="preferential">ZUS Preferencyjny (2 lata)</SelectItem>
                          <SelectItem value="start">Ulga na start (tylko zdrowotna)</SelectItem>
                          <SelectItem value="small">Mały ZUS Plus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <ToggleRow
                      label="Dobrowolne chorobowe"
                      checked={income.b2bInputs.voluntarySickness}
                      onChange={(v) => updateB2B({ voluntarySickness: v })}
                    />
                  </div>
                </SectionGroup>

                <div className="rounded-2xl bg-accent-soft/30 p-4 border border-accent-soft">
                  <h5 className="font-bold text-xs uppercase tracking-widest text-accent mb-3">Podsumowanie miesięczne (B2B)</h5>
                  <div className="divide-y divide-accent-soft/20">
                    <Row label="Składki społeczne ZUS" value={b2bBreakdown?.zusTotal || 0} negative />
                    <Row label="Składka zdrowotna" value={b2bBreakdown?.health || 0} negative />
                    <Row label="Podatek dochodowy" value={b2bBreakdown?.pit || 0} negative />
                    <Row label="Koszty operacyjne" value={b2bBreakdown?.expensesNet || 0} negative />
                    <div className="pt-2 mt-2 border-t-2 border-accent-soft/40">
                      <Row label="Dochód na czysto (Netto)" value={b2bBreakdown?.net || 0} bold positive />
                      <div className="mt-1 flex justify-between items-center text-[11px] font-medium text-muted-foreground">
                        <span>Kwota faktury brutto (z VAT):</span>
                        <span className="font-mono">{formatPLN2(b2bBreakdown?.revenueGross || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Separator() {
  return <div className="h-px bg-border my-2" />;
}
