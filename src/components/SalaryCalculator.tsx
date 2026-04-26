import { useMemo, useState } from "react";
import { calculateSalary, formatPLN, type SalaryInputs } from "@/lib/salary";
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
  muted,
  bold,
  negative,
  positive,
}: {
  label: React.ReactNode;
  value: number | string;
  muted?: boolean;
  bold?: boolean;
  negative?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        bold ? "text-base font-semibold" : "text-sm"
      } ${muted ? "text-muted-foreground" : ""}`}
    >
      <span className="leading-snug">{label}</span>
      <span
        className={`font-mono tabular-nums whitespace-nowrap ${
          negative ? "text-destructive" : positive ? "text-success" : ""
        }`}
      >
        {typeof value === "number"
          ? `${negative ? "−" : ""}${formatPLN(Math.abs(value))}`
          : value}
      </span>
    </div>
  );
}

export function SalaryCalculator() {
  const [inputs, setInputs] = useState<SalaryInputs>({
    gross: 10000,
    benefitsTaxable: 0,
    lunchAllowance: 0,
    remoteAllowance: 0,
    ppkEmployeeRate: 2,
    ppkEmployerRate: 1.5,
    kupType: "standard",
    pit2: true,
    outsideFirstThreshold: false,
    age26Exempt: false,
  });

  const set = <K extends keyof SalaryInputs>(k: K, v: SalaryInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const r = useMemo(() => calculateSalary(inputs), [inputs]);

  const netRatio = inputs.gross > 0 ? (r.net / r.totalEmployerCost) * 100 : 0;

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
      {/* INPUTS */}
      <div className="space-y-8">
        {/* Gross */}
        <section className="bg-card rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] border border-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl">Wynagrodzenie brutto</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Podstawa miesięczna z umowy o pracę
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">
              UoP · 2025
            </span>
          </div>
          <div className="space-y-4">
            <NumberField
              label="Brutto miesięcznie"
              value={inputs.gross}
              onChange={(n) => set("gross", n)}
              step={500}
            />
            <Slider
              value={[inputs.gross]}
              min={0}
              max={40000}
              step={100}
              onValueChange={([v]) => set("gross", v)}
              className="pt-2"
            />
          </div>
        </section>

        {/* Benefits & allowances */}
        <section className="bg-card rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] border border-border">
          <h2 className="font-display text-2xl mb-1">Benefity i dodatki</h2>
          <p className="text-sm text-muted-foreground mb-6">
            LuxMed, karta sportowa, bony żywieniowe, ekwiwalent za pracę zdalną
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            <NumberField
              label="Benefity (LuxMed, Multisport)"
              value={inputs.benefitsTaxable}
              onChange={(n) => set("benefitsTaxable", n)}
              hint="Opodatkowane i oskładkowane (część finansowana przez pracodawcę)"
            />
            <NumberField
              label="Bony żywieniowe / lunche"
              value={inputs.lunchAllowance}
              onChange={(n) => set("lunchAllowance", n)}
              hint="Zwolnione z ZUS do 450 zł / m-c"
            />
            <NumberField
              label="Ekwiwalent — praca zdalna"
              value={inputs.remoteAllowance}
              onChange={(n) => set("remoteAllowance", n)}
              hint="Zwolniony z PIT i ZUS"
            />
          </div>
        </section>

        {/* PPK */}
        <section className="bg-card rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] border border-border">
          <h2 className="font-display text-2xl mb-1">PPK</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Pracownicze Plany Kapitałowe — składki naliczane od brutto
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Pracownik
                </Label>
                <span className="text-sm font-mono tabular-nums">
                  {inputs.ppkEmployeeRate.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={[inputs.ppkEmployeeRate]}
                min={0}
                max={4}
                step={0.1}
                onValueChange={([v]) => set("ppkEmployeeRate", v)}
              />
              <p className="text-xs text-muted-foreground mt-2">domyślnie 2% (0.5–4%)</p>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Pracodawca
                </Label>
                <span className="text-sm font-mono tabular-nums">
                  {inputs.ppkEmployerRate.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={[inputs.ppkEmployerRate]}
                min={0}
                max={4}
                step={0.1}
                onValueChange={([v]) => set("ppkEmployerRate", v)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                domyślnie 1.5% (doliczane do podstawy PIT)
              </p>
            </div>
          </div>
        </section>

        {/* Tax settings */}
        <section className="bg-card rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] border border-border">
          <h2 className="font-display text-2xl mb-1">Ustawienia podatkowe</h2>
          <p className="text-sm text-muted-foreground mb-6">
            KUP, PIT-2, próg podatkowy, ulga dla młodych
          </p>
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">
                Koszty uzyskania przychodu
              </Label>
              <Select
                value={inputs.kupType}
                onValueChange={(v) => set("kupType", v as SalaryInputs["kupType"])}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standardowe — 250 zł</SelectItem>
                  <SelectItem value="outOfTown">Zamiejscowe — 300 zł</SelectItem>
                  <SelectItem value="none">Brak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <ToggleRow
              label="PIT-2 złożone"
              hint="Kwota wolna 300 zł / m-c (1/12 z 30 000 zł)"
              checked={inputs.pit2}
              onChange={(v) => set("pit2", v)}
            />
            <ToggleRow
              label="Drugi próg podatkowy"
              hint="Dochód roczny przekroczył 120 000 zł — całość po 32%"
              checked={inputs.outsideFirstThreshold}
              onChange={(v) => set("outsideFirstThreshold", v)}
            />
            <ToggleRow
              label="Ulga dla młodych (do 26 lat)"
              hint="Zwolnienie z PIT do limitu 85 528 zł / rok"
              checked={inputs.age26Exempt}
              onChange={(v) => set("age26Exempt", v)}
            />
          </div>
        </section>
      </div>

      {/* RESULTS */}
      <aside className="lg:sticky lg:top-6 space-y-4">
        <div className="bg-[image:var(--gradient-hero)] text-primary-foreground rounded-2xl p-8 shadow-[var(--shadow-elegant)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/60 font-medium">
            Na rękę
          </p>
          <p className="font-display text-5xl mt-2 tabular-nums">{formatPLN(r.net)}</p>
          <p className="text-sm text-primary-foreground/70 mt-1">miesięcznie</p>

          <div className="mt-6 pt-6 border-t border-primary-foreground/15 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-primary-foreground/70">Brutto</span>
              <span className="font-mono tabular-nums">{formatPLN(r.gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-foreground/70">Koszt pracodawcy</span>
              <span className="font-mono tabular-nums">{formatPLN(r.totalEmployerCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-foreground/70">Netto / koszt</span>
              <span className="font-mono tabular-nums">{netRatio.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-card)] border border-border">
          <h3 className="font-display text-lg mb-2">Rozbicie</h3>
          <Row label="Wynagrodzenie brutto" value={r.gross} />
          {r.benefitsTaxable > 0 && (
            <Row label="+ Benefity opodatkowane" value={r.benefitsTaxable} muted />
          )}
          <Separator className="my-1" />
          <Row label="ZUS — emerytalna 9.76%" value={-r.pension} negative />
          <Row label="ZUS — rentowa 1.5%" value={-r.disability} negative />
          <Row label="ZUS — chorobowa 2.45%" value={-r.sickness} negative />
          <Row label="Składka zdrowotna 9%" value={-r.health} negative />
          {r.ppkEmployee > 0 && (
            <Row label={`PPK pracownik ${inputs.ppkEmployeeRate}%`} value={-r.ppkEmployee} negative />
          )}
          <Row label="Zaliczka na PIT" value={-r.pit} negative />
          {(r.lunchAllowance > 0 || r.remoteAllowance > 0) && (
            <>
              <Separator className="my-1" />
              {r.lunchAllowance > 0 && (
                <Row label="+ Bony żywieniowe (do ręki)" value={r.lunchAllowance} positive />
              )}
              {r.remoteAllowance > 0 && (
                <Row label="+ Ekwiwalent zdalny (do ręki)" value={r.remoteAllowance} positive />
              )}
            </>
          )}
          <Separator className="my-2" />
          <Row label="Netto" value={r.net} bold />
        </div>

        <details className="bg-card rounded-2xl p-6 shadow-[var(--shadow-card)] border border-border group">
          <summary className="font-display text-lg cursor-pointer list-none flex items-center justify-between">
            Szczegóły podstawy PIT
            <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform">
              ▾
            </span>
          </summary>
          <div className="mt-3">
            <Row label="Podstawa ZUS" value={r.zusBase} muted />
            <Row label="Suma składek ZUS" value={r.zusTotal} muted />
            <Row label="Podstawa zdrowotnej" value={r.healthBase} muted />
            <Row label="KUP" value={r.kup} muted />
            <Row label="PPK pracodawcy (do PIT)" value={r.ppkEmployer} muted />
            <Row label="Podstawa opodatkowania" value={r.taxBase} muted />
            <Row label="Kwota wolna miesięczna" value={r.taxFreeAllowance} muted />
          </div>
        </details>
      </aside>
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
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
