import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import {
  projectPortfolio,
  calculateRealEstate,
  type RealEstateScenario,
  type PortfolioInputs,
} from "@/lib/finance";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export const Route = createFileRoute("/kalkulatory")({
  head: () => ({
    meta: [
      { title: "Kalkulatory — Płaca.netto" },
      {
        name: "description",
        content:
          "Kalkulator portfela inwestycyjnego (ETF/akcje) oraz scenariusz mieszkania pod wynajem z hipoteką, ROI i wykresami.",
      },
    ],
  }),
  component: CalculatorsPage,
});

function CalculatorsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Kalkulatory
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          Symuluj <span className="italic text-accent">scenariusze</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Sprawdź ile naprawdę zarobi twój portfel ETF i czy mieszkanie na wynajem ma sens — z
          uwzględnieniem hipoteki, kosztów, pustostanów i ryczałtu 8.5%.
        </p>
      </header>

      <Tabs defaultValue="portfolio" className="space-y-6">
        <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2 sm:grid-cols-2">
          <TabsTrigger value="portfolio">Portfel ETF / akcji</TabsTrigger>
          <TabsTrigger value="realestate">Mieszkanie na wynajem</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio">
          <PortfolioCalculator />
        </TabsContent>
        <TabsContent value="realestate">
          <RealEstateCalculator />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ============================================================
   PORTFOLIO CALCULATOR
============================================================ */
function PortfolioCalculator() {
  const [inputs, setInputs] = useState<PortfolioInputs>({
    initial: 20000,
    monthlyContribution: 1500,
    years: 20,
    annualReturnPct: 8,
    annualFeePct: 0.22,
    annualInflationPct: 3,
  });

  const projection = useMemo(() => projectPortfolio(inputs), [inputs]);
  const last = projection[projection.length - 1];
  const totalContributed = last?.contributions ?? 0;
  const finalValue = last?.value ?? 0;
  const realValue = last?.realValue ?? 0;
  const totalGain = finalValue - totalContributed;

  return (
    <div className="grid lg:grid-cols-[380px,1fr] gap-6">
      <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)] space-y-4 h-fit">
        <h2 className="font-display text-xl">Założenia</h2>

        <NumField
          label="Wkład początkowy"
          value={inputs.initial}
          onChange={(v) => setInputs({ ...inputs, initial: v })}
        />
        <NumField
          label="Wpłata miesięczna"
          value={inputs.monthlyContribution}
          onChange={(v) => setInputs({ ...inputs, monthlyContribution: v })}
        />

        <SliderField
          label="Horyzont (lat)"
          value={inputs.years}
          min={1}
          max={40}
          step={1}
          format={(v) => `${v} lat`}
          onChange={(v) => setInputs({ ...inputs, years: v })}
        />
        <SliderField
          label="Roczny zwrot (%)"
          value={inputs.annualReturnPct}
          min={0}
          max={15}
          step={0.5}
          format={(v) => `${v}%`}
          onChange={(v) => setInputs({ ...inputs, annualReturnPct: v })}
        />
        <SliderField
          label="Opłata roczna TER (%)"
          value={inputs.annualFeePct}
          min={0}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}%`}
          onChange={(v) => setInputs({ ...inputs, annualFeePct: v })}
        />
        <SliderField
          label="Inflacja roczna (%)"
          value={inputs.annualInflationPct}
          min={0}
          max={10}
          step={0.5}
          format={(v) => `${v}%`}
          onChange={(v) => setInputs({ ...inputs, annualInflationPct: v })}
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Wpłaty łącznie" value={formatPLN(totalContributed)} />
          <Stat label="Wartość końcowa" value={formatPLN(finalValue)} tone="success" />
          <Stat
            label="Zysk"
            value={formatPLN(totalGain)}
            sub={
              totalContributed > 0
                ? `+${((totalGain / totalContributed) * 100).toFixed(0)}%`
                : ""
            }
            tone="success"
          />
          <Stat
            label="Realna wartość"
            value={formatPLN(realValue)}
            sub={`po inflacji ${inputs.annualInflationPct}%`}
          />
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-1">Wzrost portfela</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Wpłaty (kapitał) vs wartość rynkowa vs realna wartość po inflacji
          </p>
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={projection}>
                <defs>
                  <linearGradient id="g-value" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.13 145)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="oklch(0.62 0.13 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-contrib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.1 250)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="oklch(0.55 0.1 250)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} unit="r" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatPLN(v)}
                  labelFormatter={(y) => `Rok ${y}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Wartość portfela"
                  stroke="oklch(0.62 0.13 145)"
                  strokeWidth={2}
                  fill="url(#g-value)"
                />
                <Area
                  type="monotone"
                  dataKey="contributions"
                  name="Wpłacony kapitał"
                  stroke="oklch(0.55 0.1 250)"
                  strokeWidth={2}
                  fill="url(#g-contrib)"
                />
                <Line
                  type="monotone"
                  dataKey="realValue"
                  name="Realna wartość (po inflacji)"
                  stroke="oklch(0.55 0.18 30)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REAL ESTATE CALCULATOR
============================================================ */
function RealEstateCalculator() {
  const [s, setS] = useState<RealEstateScenario>({
    purchasePrice: 650000,
    downPaymentPct: 20,
    renovationCost: 60000,
    closingCostsPct: 4,
    mortgageRatePct: 7.5,
    mortgageYears: 30,
    monthlyRent: 3200,
    monthlyCosts: 700,
    vacancyRatePct: 5,
    taxRatePct: 8.5,
    rentGrowthPct: 3,
    appreciationPct: 4,
    holdingYears: 15,
  });

  const r = useMemo(() => calculateRealEstate(s), [s]);

  const cashflowPositive = r.monthlyCashflow >= 0;

  return (
    <div className="grid lg:grid-cols-[400px,1fr] gap-6">
      {/* Inputs */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)] space-y-5 h-fit">
        <div>
          <h2 className="font-display text-xl mb-3">Zakup</h2>
          <div className="space-y-3">
            <NumField
              label="Cena mieszkania"
              value={s.purchasePrice}
              onChange={(v) => setS({ ...s, purchasePrice: v })}
            />
            <SliderField
              label="Wkład własny"
              value={s.downPaymentPct}
              min={10}
              max={100}
              step={5}
              format={(v) => `${v}% · ${formatPLN((s.purchasePrice * v) / 100)}`}
              onChange={(v) => setS({ ...s, downPaymentPct: v })}
            />
            <NumField
              label="Remont / wykończenie"
              value={s.renovationCost}
              onChange={(v) => setS({ ...s, renovationCost: v })}
            />
            <SliderField
              label="Koszty około-transakcyjne"
              value={s.closingCostsPct}
              min={0}
              max={10}
              step={0.5}
              format={(v) => `${v}% (PCC, notariusz)`}
              onChange={(v) => setS({ ...s, closingCostsPct: v })}
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="font-display text-xl mb-3">Hipoteka</h2>
          <div className="space-y-3">
            <SliderField
              label="Oprocentowanie"
              value={s.mortgageRatePct}
              min={2}
              max={12}
              step={0.1}
              format={(v) => `${v.toFixed(1)}%`}
              onChange={(v) => setS({ ...s, mortgageRatePct: v })}
            />
            <SliderField
              label="Okres kredytu"
              value={s.mortgageYears}
              min={5}
              max={35}
              step={1}
              format={(v) => `${v} lat`}
              onChange={(v) => setS({ ...s, mortgageYears: v })}
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="font-display text-xl mb-3">Wynajem</h2>
          <div className="space-y-3">
            <NumField
              label="Czynsz miesięczny (od najemcy)"
              value={s.monthlyRent}
              onChange={(v) => setS({ ...s, monthlyRent: v })}
            />
            <NumField
              label="Koszty stałe (admin., zarządzanie, ubezp.)"
              value={s.monthlyCosts}
              onChange={(v) => setS({ ...s, monthlyCosts: v })}
            />
            <SliderField
              label="Pustostany"
              value={s.vacancyRatePct}
              min={0}
              max={30}
              step={1}
              format={(v) => `${v}%`}
              onChange={(v) => setS({ ...s, vacancyRatePct: v })}
            />
            <SliderField
              label="Podatek (ryczałt)"
              value={s.taxRatePct}
              min={0}
              max={15}
              step={0.5}
              format={(v) => `${v}% (8.5/12.5)`}
              onChange={(v) => setS({ ...s, taxRatePct: v })}
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="font-display text-xl mb-3">Długi termin</h2>
          <div className="space-y-3">
            <SliderField
              label="Wzrost czynszu rocznie"
              value={s.rentGrowthPct}
              min={0}
              max={10}
              step={0.5}
              format={(v) => `${v}%`}
              onChange={(v) => setS({ ...s, rentGrowthPct: v })}
            />
            <SliderField
              label="Wzrost wartości nieruchomości rocznie"
              value={s.appreciationPct}
              min={-5}
              max={10}
              step={0.5}
              format={(v) => `${v}%`}
              onChange={(v) => setS({ ...s, appreciationPct: v })}
            />
            <SliderField
              label="Okres trzymania"
              value={s.holdingYears}
              min={1}
              max={30}
              step={1}
              format={(v) => `${v} lat`}
              onChange={(v) => setS({ ...s, holdingYears: v })}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Wkład gotówkowy"
            value={formatPLN(r.totalUpfront)}
            sub={`Wpłata ${formatPLN(r.downPayment)} + remont + koszty`}
          />
          <Stat
            label="Rata kredytu"
            value={formatPLN2(r.monthlyPmt)}
            sub={`Kwota kredytu ${formatPLN(r.loanAmount)}`}
          />
          <Stat
            label="Cashflow / m-c"
            value={formatPLN2(r.monthlyCashflow)}
            sub={cashflowPositive ? "z plusem ✓" : "dopłacasz każdego miesiąca"}
            tone={cashflowPositive ? "success" : "destructive"}
          />
          <Stat
            label="Cash-on-cash"
            value={`${r.cashOnCashPct.toFixed(1)}%`}
            sub={`Yield brutto ${r.grossYieldPct.toFixed(1)}%`}
            tone={r.cashOnCashPct >= 4 ? "success" : "default"}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <MiniStat label="Yield netto" value={`${r.netYieldPct.toFixed(2)}%`} />
          <MiniStat
            label="Czas zwrotu (CF)"
            value={r.breakEvenMonths > 0 ? `${(r.breakEvenMonths / 12).toFixed(1)} lat` : "—"}
          />
          <MiniStat
            label={`Roczny IRR (${s.holdingYears} lat)`}
            value={`${r.irrAnnualPct.toFixed(1)}%`}
          />
        </div>

        {/* Cashflow & equity chart */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-1">Skumulowany cashflow vs kapitał własny</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Wartość mieszkania rośnie, kredyt maleje — kapitał własny to różnica.
          </p>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={r.yearly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} unit="r" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatPLN(v)}
                  labelFormatter={(y) => `Rok ${y}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={r.totalUpfront} stroke="#888" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="equity"
                  name="Kapitał własny"
                  stroke="oklch(0.62 0.13 145)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeCashflow"
                  name="Skumulowany cashflow"
                  stroke="oklch(0.55 0.18 30)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="totalValueIfSold"
                  name="Łączny zwrot przy sprzedaży"
                  stroke="oklch(0.55 0.1 250)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Annual cashflow bar */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-1">Roczny cashflow</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Po kosztach, racie i podatku. Czynsz rośnie {s.rentGrowthPct}% rocznie.
          </p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={r.yearly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} unit="r" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatPLN(v)}
                  labelFormatter={(y) => `Rok ${y}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke="#888" />
                <Bar dataKey="cashflow" name="Cashflow roczny" radius={[4, 4, 0, 0]}>
                  {r.yearly.map((y, i) => (
                    <Cell
                      key={i}
                      fill={y.cashflow >= 0 ? "oklch(0.62 0.13 145)" : "oklch(0.55 0.18 30)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg mb-3">Podsumowanie po {s.holdingYears} latach</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Wpłacone</p>
              <p className="font-mono tabular-nums text-xl mt-1">{formatPLN(r.totalUpfront)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Łączny cashflow
              </p>
              <p
                className={`font-mono tabular-nums text-xl mt-1 ${r.totalCashflow >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatPLN(r.totalCashflow)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Kapitał własny
              </p>
              <p className="font-mono tabular-nums text-xl mt-1">{formatPLN(r.finalEquity)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Łączny zysk
              </p>
              <p
                className={`font-mono tabular-nums text-xl mt-1 ${r.totalReturn >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatPLN(r.totalReturn)}
                <span className="text-sm text-muted-foreground ml-1">
                  ({r.totalReturnPct.toFixed(0)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Shared UI bits
============================================================ */
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 h-10 font-mono tabular-nums"
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </label>
        <span className="font-mono tabular-nums text-xs">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-sm font-semibold">{value}</span>
    </div>
  );
}

// recharts Cell needs to be imported separately for Bar coloring
import { Cell } from "recharts";
