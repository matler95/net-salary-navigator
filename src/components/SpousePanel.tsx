import { useMemo } from "react";
import { calculateSalary, formatPLN2, type SalaryInputs } from "@/lib/salary";
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
import { actions, type Spouse } from "@/lib/store";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function NumberField({
  label,
  value,
  onChange,
  suffix = "zł",
  hint,
  step = 50,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={0}
          className="pr-12 font-mono tabular-nums text-base h-11"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        bold ? "text-base font-semibold" : "text-sm"
      } ${muted ? "text-muted-foreground" : ""}`}
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
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SpousePanel({ spouse, canDelete }: { spouse: Spouse; canDelete: boolean }) {
  const r = useMemo(() => calculateSalary(spouse.inputs), [spouse.inputs]);
  const set = <K extends keyof SalaryInputs>(k: K, v: SalaryInputs[K]) =>
    actions.updateSpouseInputs(spouse.id, { [k]: v } as Partial<SalaryInputs>);

  // Threshold progression
  const monthsToSecondThreshold = r.taxBase > 0 ? Math.ceil(120000 / r.taxBase) : null;

  return (
    <div className="bg-card rounded-2xl shadow-[var(--shadow-card)] border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={spouse.name}
            onChange={(e) => actions.updateSpouse(spouse.id, { name: e.target.value })}
            placeholder="Wpisz imię lub nazwę"
            className="font-display text-lg h-9 px-3 py-2 bg-white/50 dark:bg-black/20 border border-transparent rounded-md hover:border-border focus:border-accent focus:bg-background transition-all focus-visible:ring-1 focus-visible:ring-accent shadow-none max-w-xs"
          />
          <span className="text-xs text-muted-foreground">— edytuj</span>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.removeSpouse(spouse.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="p-5 sm:p-6 grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <NumberField
              label="Brutto miesięcznie"
              value={spouse.inputs.gross}
              onChange={(n) => set("gross", n)}
              step={500}
            />
            <Slider
              value={[spouse.inputs.gross]}
              min={0}
              max={50000}
              step={100}
              onValueChange={([v]) => set("gross", v)}
              className="pt-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Benefity (LuxMed, sport)"
              value={spouse.inputs.benefitsTaxable}
              onChange={(n) => set("benefitsTaxable", n)}
            />
            <NumberField
              label="Bony żywieniowe"
              value={spouse.inputs.lunchAllowance}
              onChange={(n) => set("lunchAllowance", n)}
              hint="ZUS-free do 450 zł"
            />
          </div>

          <div className="bg-muted/30 rounded-xl p-4 border border-border space-y-3">
            <ToggleRow
              label="Samochód służbowy do celów prywatnych"
              hint="Przychód opodatkowany i oskładkowany (UoP)"
              checked={spouse.inputs.companyCarEnabled}
              onChange={(v) => set("companyCarEnabled", v)}
            />
            {spouse.inputs.companyCarEnabled && (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Wycena świadczenia
                  </Label>
                  <Select
                    value={spouse.inputs.companyCarMode}
                    onValueChange={(v) =>
                      set("companyCarMode", v as SalaryInputs["companyCarMode"])
                    }
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
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Ryczałt miesięczny
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
                    hint="Ręczna wycena świadczenia"
                  />
                )}
              </>
            )}
          </div>

          {/* WHF Calculator */}
          {/* <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <Label className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold block mb-4">
              Praca zdalna (dni × stawka)
            </Label>
            <div className="grid grid-cols-1 gap-3 mb-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">
                  Dni WHF
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={spouse.inputs.whfDays ?? 0}
                  onChange={(e) => set("whfDays", parseFloat(e.target.value) || 0)}
                  min={0}
                  step={1}
                  className="font-mono text-base h-11 w-full"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">
                  Stawka/dzień
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={spouse.inputs.whfDailyRate ?? 0}
                    onChange={(e) => set("whfDailyRate", parseFloat(e.target.value) || 0)}
                    min={0}
                    step={1}
                    className="font-mono text-base h-11 w-full pr-12"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    zł
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">
                  Razem
                </Label>
                <div className="bg-white dark:bg-black/20 border border-border rounded-md px-3 font-mono text-base font-medium flex items-center justify-end h-11 w-full">
                  {formatPLN2((spouse.inputs.whfDays ?? 0) * (spouse.inputs.whfDailyRate ?? 0))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Lub wprowadź kwotę ręcznie poniżej (PIT/ZUS-free)
            </p>
          </div> */}

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Praca zdalna (razem)"
              value={spouse.inputs.remoteAllowance}
              onChange={(n) => set("remoteAllowance", n)}
              hint="PIT/ZUS-free"
            />
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                KUP standardowe
              </Label>
              <Select
                value={spouse.inputs.kupType}
                onValueChange={(v) => set("kupType", v as SalaryInputs["kupType"])}
              >
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">250 zł</SelectItem>
                  <SelectItem value="outOfTown">300 zł</SelectItem>
                  <SelectItem value="none">Brak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Autorskie KUP */}
          <div className="bg-accent/5 rounded-xl p-4 border border-accent/20 space-y-3">
            <ToggleRow
              label="Autorskie KUP (50%)"
              hint="Część wynagrodzenia jako honorarium objęte 50% KUP. Limit roczny 120 000 zł."
              checked={spouse.inputs.autorskiSharePct > 0}
              onChange={(v) => set("autorskiSharePct", v ? 80 : 0)}
            />
            {spouse.inputs.autorskiSharePct > 0 && (
              <div className="pt-2 border-t border-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Udział honorarium
                  </Label>
                  <span className="text-sm font-mono tabular-nums text-accent font-medium">
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
                {r.kupAutorski > 0 && (
                  <p className="text-xs mt-3 text-success font-medium">
                    Aktywne: {formatPLN2(r.kupAutorski)} odpisu KUP / m-c
                  </p>
                )}
              </div>
            )}
          </div>

          {/* PPK */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  PPK pracownik
                </Label>
                <span className="text-sm font-mono tabular-nums">
                  {spouse.inputs.ppkEmployeeRate.toFixed(1)}%
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
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  PPK pracodawca
                </Label>
                <span className="text-sm font-mono tabular-nums">
                  {spouse.inputs.ppkEmployerRate.toFixed(1)}%
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

          <Separator />
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
            label="Ulga dla młodych (<26)"
            checked={spouse.inputs.age26Exempt}
            onChange={(v) => set("age26Exempt", v)}
          />
        </div>

        {/* Results */}
        <div className="order-first lg:order-last space-y-4">
          <div className="bg-[image:var(--gradient-hero)] text-primary-foreground rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
            <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/60 font-medium">
              Na rękę
            </p>
            <p className="font-display text-4xl mt-1.5 tabular-nums">{formatPLN2(r.net)}</p>
            <div className="mt-4 pt-4 border-t border-primary-foreground/15 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-primary-foreground/60">Brutto</p>
                <p className="font-mono tabular-nums text-sm">{formatPLN2(r.gross)}</p>
              </div>
              <div>
                <p className="text-primary-foreground/60">Koszt pracodawcy</p>
                <p className="font-mono tabular-nums text-sm">{formatPLN2(r.totalEmployerCost)}</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/40 rounded-xl p-4">
            <Row label="Brutto" value={r.gross} muted />
            {r.companyCarTaxable > 0 && (
              <Row label="Samochód służbowy (przychód)" value={r.companyCarTaxable} muted />
            )}
            <Row label="ZUS (suma)" value={-r.zusTotal} negative />
            <Row label="Zdrowotna 9%" value={-r.health} negative />
            {r.ppkEmployee > 0 && <Row label="PPK pracownik" value={-r.ppkEmployee} negative />}
            <Row label="KUP (standardowe)" value={r.kupStandard} muted />
            {r.kupAutorski > 0 && <Row label="KUP autorskie 50%" value={r.kupAutorski} positive />}
            <Row label="Zaliczka PIT" value={-r.pit} negative />
            <Separator className="my-1.5" />
            <Row label="Netto" value={r.net} bold />
          </div>

          {!spouse.inputs.outsideFirstThreshold && monthsToSecondThreshold && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-warning-foreground/80 font-medium">
                II próg podatkowy
              </p>
              <p className="text-sm mt-1">
                Przy obecnym tempie:{" "}
                <span className="font-semibold">
                  {monthsToSecondThreshold >= 12
                    ? "nieosiągnięty w 2025"
                    : `przekroczenie w ${monthIndexToName(monthsToSecondThreshold)}`}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Roczna podstawa: {formatPLN2(r.annualTaxBase)} / 120 000 zł
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
