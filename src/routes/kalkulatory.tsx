import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { calculateAnnualAverageNet, formatPLN, formatPLN2, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";
import { useAppState } from "@/lib/store";
import { Separator } from "@/components/ui/separator";
import {
  projectPortfolio,
  calculateRealEstate,
  getExpenseMonthlyAverage,
  monthlyPayment,
  minBreakEvenRent,
  getInvestmentVerdict,
  wiborSensitivity,
  type RealEstateScenario,
  type PortfolioInputs,
  type InvestmentVerdict,
  type WiborScenario,
} from "@/lib/finance";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Home,
  Building2,
  TrendingUp,
  Percent,
  ChevronRight,
  Info,
  Calendar,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  MinusCircle,
  BarChart2,
} from "lucide-react";
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
      { title: "Kalkulatory — Saldeo" },
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <header className="flex flex-col gap-6 relative">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
            Kalkulatory
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Symuluj <span className="italic text-accent">scenariusze</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Sprawdź, ile możesz zarobić na inwestowaniu w akcje lub czy kupno mieszkania na wynajem faktycznie Ci się opłaci. Policz zyski, raty kredytu i koszty w prosty sposób.
          </p>
        </div>
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

  // BUDGET INTEGRATION
  const spouses = useAppState((st) => st.spouses);
  const expenses = useAppState((st) => st.expenses);
  const loans = useAppState((st) => st.loans);
  const globalSettings = useAppState((st) => st.globalSettings);

  const budgetImpact = useMemo(() => {
    const totalNetIncome = spouses.reduce(
      (sum, sp) => sum + calculateAnnualAverageNet(sp.inputs, globalSettings),
      0
    );
    const totalExpenses = expenses.reduce((sum, e) => sum + getExpenseMonthlyAverage(e), 0);
    const existingLoanPayments = loans.reduce(
      (sum, l) =>
        sum +
        monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining) +
        (l.mortgageInsuranceMonthly ?? 0),
      0
    );

    const currentDisposable = totalNetIncome - totalExpenses - existingLoanPayments;
    const remainingAfterInvestment = currentDisposable - inputs.monthlyContribution;

    return {
      totalNetIncome,
      currentDisposable,
      remainingAfterInvestment,
    };
  }, [spouses, expenses, loans, globalSettings, inputs.monthlyContribution]);

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Hero Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-success/5 border-success/20 p-8 shadow-warm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Przewidywany majątek</p>
          <h2 className="font-display text-5xl sm:text-6xl tracking-tight text-success">
            {formatPLN(finalValue)}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Tyle będziesz mieć po {inputs.years} latach</p>
          <div className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 text-success">
            <TrendingUp className="w-full h-full" />
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border p-8 shadow-card flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Czysty zysk</p>
          <h2 className="font-display text-4xl text-accent">+{formatPLN(totalGain)}</h2>
          <p className="text-xs text-muted-foreground mt-2">
            {totalContributed > 0 ? `Zyskasz +${((totalGain / totalContributed) * 100).toFixed(0)}%` : ""} względem wpłat
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-border p-8 shadow-card flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Realna wartość (dzisiejsza)</p>
          <h2 className="font-display text-4xl text-foreground">{formatPLN(realValue)}</h2>
          <p className="text-xs text-muted-foreground mt-2">Tyle te pieniądze będą warte, biorąc pod uwagę inflację</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px,1fr] gap-8 items-start">
        <div className="bg-card rounded-3xl p-8 border border-border shadow-card space-y-8 h-fit">
          <div>
            <h2 className="font-display text-2xl mb-6 flex items-center gap-2">
              <Percent className="w-5 h-5 text-accent" /> Założenia
            </h2>

            <div className="space-y-6">
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

              <Separator className="my-4" />

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
                label="Przewidywany zysk roczny (%)"
                value={inputs.annualReturnPct}
                min={0}
                max={15}
                step={0.5}
                format={(v) => `${v}%`}
                onChange={(v) => setInputs({ ...inputs, annualReturnPct: v })}
              />
              <SliderField
                label="Koszty zarządzania rocznie (%)"
                value={inputs.annualFeePct}
                min={0}
                max={2}
                step={0.05}
                format={(v) => `${v.toFixed(2)}%`}
                onChange={(v) => setInputs({ ...inputs, annualFeePct: v })}
              />
              <SliderField
                label="Przewidywana inflacja (%)"
                value={inputs.annualInflationPct}
                min={0}
                max={10}
                step={0.5}
                format={(v) => `${v}%`}
                onChange={(v) => setInputs({ ...inputs, annualInflationPct: v })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-3xl p-8 border border-border shadow-card">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-display text-2xl mb-1">Wzrost portfela</h3>
                <p className="text-sm text-muted-foreground">
                  Wpłaty (kapitał) vs wartość rynkowa vs realna wartość
                </p>
              </div>
              <div className="hidden sm:flex gap-4 text-[10px] uppercase tracking-widest font-bold">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--chart-2)]" /> Wartość</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--chart-3)]" /> Kapitał</div>
              </div>
            </div>

            <div className="h-96">
              <ResponsiveContainer>
                <AreaChart data={projection}>
                  <defs>
                    <linearGradient id="g-value" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-contrib" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.015 85)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fontWeight: 500 }}
                    unit="r"
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    formatter={(v: number) => formatPLN(v)}
                    labelFormatter={(y) => `Rok ${y}`}
                    contentStyle={{ fontSize: 12, borderRadius: 16, border: 'none', boxShadow: 'var(--shadow-elevated)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Wartość rynkowa"
                    stroke="var(--chart-2)"
                    strokeWidth={3}
                    fill="url(#g-value)"
                  />
                  <Area
                    type="monotone"
                    dataKey="contributions"
                    name="Wpłacony kapitał"
                    stroke="var(--chart-3)"
                    strokeWidth={3}
                    fill="url(#g-contrib)"
                  />
                  <Line
                    type="monotone"
                    dataKey="realValue"
                    name="Realna wartość"
                    stroke="oklch(0.55 0.18 30)"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-8 border border-accent/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Wallet className="w-24 h-24 text-accent" />
            </div>

            <h3 className="font-display text-2xl mb-6 flex items-center gap-2 text-accent">
              Wpływ na domowy budżet
            </h3>

            <div className="grid sm:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Nadwyżka po inwestycji</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-display font-bold">
                    {formatPLN(budgetImpact.remainingAfterInvestment)}
                  </p>
                  <span className="text-xs font-bold text-destructive">
                    (-{formatPLN(inputs.monthlyContribution)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Kwota, która zostaje na życie po odłożeniu na inwestycje.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Stopa oszczędności</p>
                <p className="text-3xl font-display font-bold">
                  {budgetImpact.totalNetIncome > 0
                    ? ((inputs.monthlyContribution / budgetImpact.totalNetIncome) * 100).toFixed(0)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Procent dochodu netto przeznaczany na ten cel.
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-background/50 backdrop-blur-sm rounded-2xl border border-accent/10 text-sm text-muted-foreground italic">
              "Przy Twoich dochodach netto ({formatPLN(budgetImpact.totalNetIncome)} miesięcznie), ta inwestycja
              pochłania {budgetImpact.totalNetIncome > 0 ? ((inputs.monthlyContribution / budgetImpact.totalNetIncome) * 100).toFixed(1) : 0}% Twojego budżetu netto."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import { RealEstateCalculatorV2 as RealEstateCalculator } from "@/components/real-estate-calculator";

/* ============================================================
   Shared UI bits (used by PortfolioCalculator)
============================================================ */

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
  const [localValue, setLocalValue] = useState<string>(formatLocaleAmount(value));

  useEffect(() => {
    const parsedLocal = parseLocaleAmount(localValue);
    if (parsedLocal !== value) {
      setLocalValue(formatLocaleAmount(value));
    }
  }, [value]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 group">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
          {label}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground italic mt-0.5 block leading-tight">{hint}</span>}
      </div>
      <Input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(parseLocaleAmount(e.target.value));
        }}
        onBlur={() => setLocalValue(formatLocaleAmount(value))}
        className="h-10 font-mono tabular-nums text-right bg-muted/10 border-border focus:bg-background sm:w-32 transition-colors group-hover:bg-muted/30"
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
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </label>
        <span className="font-mono tabular-nums text-xs bg-muted/40 px-2 py-1 rounded-md">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        className="py-1 cursor-pointer"
      />
    </div>
  );
}



function MiniStat({
  label,
  value,
  badge,
  badgeTone,
  hint,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeTone?: "success" | "warning" | "destructive";
  hint?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {badge && (
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
            badgeTone === "success" ? "bg-success/15 text-success" :
            badgeTone === "warning" ? "bg-warning/15 text-warning-foreground" :
            badgeTone === "destructive" ? "bg-destructive/15 text-destructive" :
            "bg-muted text-muted-foreground"
          )}>{badge}</span>
        )}
      </div>
      <span className="font-mono tabular-nums text-sm font-semibold">{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground italic">{hint}</span>}
    </div>
  );
}
