import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatPLN, formatPLN2, parseLocaleAmount } from "@/lib/salary";
import { Separator } from "@/components/ui/separator";
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
import { StatCard } from "@/components/ui/stat-card";

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

      <Tabs defaultValue="realestate" className="space-y-6">
        <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2 sm:grid-cols-2">
          <TabsTrigger value="realestate">Mieszkanie na wynajem</TabsTrigger>
          <TabsTrigger value="portfolio">Portfel ETF / akcji</TabsTrigger>
        </TabsList>

        <TabsContent value="realestate">
          <RealEstateCalculator />
        </TabsContent>
        <TabsContent value="portfolio">
          <PortfolioCalculator />
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
          <StatCard label="Wpłaty łącznie" value={formatPLN(totalContributed)} />
          <StatCard label="Wartość końcowa" value={formatPLN(finalValue)} tone="success" />
          <StatCard
            label="Zysk"
            value={formatPLN(totalGain)}
            sub={
              totalContributed > 0 ? `+${((totalGain / totalContributed) * 100).toFixed(0)}%` : ""
            }
            tone="success"
          />
          <StatCard
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
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
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
    renovationCost: 50000,
    closingCostsPct: 4.5,
    mortgageRatePct: 7.2,
    mortgageYears: 30,
    mortgageType: "equal",
    bankCommissionPct: 0,
    mortgageInsuranceMonthly: 150,
    monthlyRent: 3500,
    monthlyCosts: 800,
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
          <h2 className="font-display text-xl mb-3">Kredyt hipoteczny</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setS({ ...s, mortgageType: "equal" })}
                className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                  s.mortgageType === "equal"
                    ? "bg-accent text-accent-foreground border-accent font-bold"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Raty równe
              </button>
              <button
                type="button"
                onClick={() => setS({ ...s, mortgageType: "decreasing" })}
                className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                  s.mortgageType === "decreasing"
                    ? "bg-accent text-accent-foreground border-accent font-bold"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Raty malejące
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
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
                label="Okres"
                value={s.mortgageYears}
                min={5}
                max={35}
                step={1}
                format={(v) => `${v} lat`}
                onChange={(v) => setS({ ...s, mortgageYears: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Prowizja (%)"
                value={s.bankCommissionPct}
                onChange={(v) => setS({ ...s, bankCommissionPct: v })}
                hint="Upfront"
              />
              <NumField
                label="Ubezpieczenie"
                value={s.mortgageInsuranceMonthly}
                onChange={(v) => setS({ ...s, mortgageInsuranceMonthly: v })}
                hint="Miesięcznie"
              />
            </div>
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
          <StatCard
            label="Inwestycja (cash)"
            value={formatPLN(r.totalUpfront)}
            sub={`Wkład + remont + koszty`}
          />
          <StatCard
            label="Miesięczna rata"
            value={formatPLN2(r.monthlyPmt)}
            sub={s.mortgageInsuranceMonthly > 0 ? `+ ${s.mortgageInsuranceMonthly} zł ubezp.` : `Kredyt: ${formatPLN(r.loanAmount)}`}
          />
          <StatCard
            label="Cashflow netto"
            value={formatPLN2(r.monthlyCashflow)}
            sub={cashflowPositive ? "Po wszystkich kosztach ✓" : "Wymaga dopłaty"}
            tone={cashflowPositive ? "success" : "destructive"}
          />
          <StatCard
            label="Cash-on-cash"
            value={`${r.cashOnCashPct.toFixed(1)}%`}
            sub={`ROI z samej gotówki`}
            tone={r.cashOnCashPct >= 5 ? "success" : r.cashOnCashPct > 0 ? "default" : "destructive"}
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
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
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
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
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

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Detailed Summary */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              Podsumowanie po {s.holdingYears} latach
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Wpłacony kapitał (cash)</span>
                <span className="font-mono font-semibold">{formatPLN(r.totalUpfront)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Skumulowany cashflow</span>
                <span className={`font-mono font-semibold ${r.totalCashflow >= 0 ? "text-success" : "text-destructive"}`}>
                  {r.totalCashflow >= 0 ? "+" : ""}{formatPLN(r.totalCashflow)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Spłacony kapitał w kredycie</span>
                <span className="font-mono font-semibold text-success">
                  +{formatPLN(r.finalEquity - (s.purchasePrice * s.appreciationPct * s.holdingYears / 100) - r.downPayment)} 
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Wzrost wartości (prognoza)</span>
                <span className="font-mono font-semibold text-success">
                  +{formatPLN(r.yearly[r.yearly.length - 1].propertyValue - s.purchasePrice)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-1">
                <span className="font-bold">Łączny zysk (netto)</span>
                <div className="text-right">
                  <p className="font-display text-2xl text-success">{formatPLN(r.totalReturn)}</p>
                  <p className="text-xs text-muted-foreground">+{r.totalReturnPct.toFixed(0)}% zwrotu z kapitału</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mortgage Breakdown */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Koszty kredytu ({s.holdingYears} lat)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Suma zapłaconych odsetek</span>
                <span className="font-mono font-semibold text-destructive">{formatPLN(r.totalInterestPaid)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Prowizje i ubezpieczenia</span>
                <span className="font-mono font-semibold text-destructive">
                  {formatPLN(r.totalMortgageCost - r.totalInterestPaid)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Średni koszt miesięczny (RRSO eq.)</span>
                <span className="font-mono font-semibold">{formatPLN2(r.totalMortgageCost / (s.holdingYears * 12))}</span>
              </div>
              <Separator />
              <div className="pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kredyt na <span className="font-bold">{formatPLN(r.loanAmount)}</span> ({s.mortgageYears} lat). 
                  Pozostały kapitał do spłaty po {s.holdingYears} latach: 
                  <span className="font-mono font-bold block text-lg mt-1">
                    {formatPLN(r.yearly[r.yearly.length - 1].loanBalance)}
                  </span>
                </p>
              </div>
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
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground italic">{hint}</span>}
      </div>
      <Input
        type="text"
        inputMode="decimal"
        value={value || ""}
        onChange={(e) => onChange(parseLocaleAmount(e.target.value))}
        className="h-10 font-mono tabular-nums text-right bg-muted/20 border-border focus:bg-background"
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



function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-sm font-semibold">{value}</span>
    </div>
  );
}
