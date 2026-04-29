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

  const [costs, setCosts] = useState({
    admin: 500,
    management: 0,
    insurance: 50,
    reserve: 250,
  });

  const [isInsuranceManual, setIsInsuranceManual] = useState(false);

  useEffect(() => {
    if (!isInsuranceManual && s.purchasePrice > 0) {
      const principal = s.purchasePrice * (1 - s.downPaymentPct / 100);
      const suggestedInsurance = Math.round(principal * 0.0004);
      setS(prev => ({ ...prev, mortgageInsuranceMonthly: suggestedInsurance }));
    }
  }, [s.purchasePrice, s.downPaymentPct, isInsuranceManual]);

  useEffect(() => {
    const total = Object.values(costs).reduce((a, b) => a + b, 0);
    setS(prev => ({ ...prev, monthlyCosts: total }));
  }, [costs]);

  const r = useMemo(() => calculateRealEstate(s), [s]);
  const cashflowPositive = r.monthlyCashflow >= 0;
  const minRent = useMemo(() => minBreakEvenRent(s, r), [s, r]);
  const verdict = getInvestmentVerdict(r);
  const wiborData = useMemo(() => wiborSensitivity(s, r), [s, r]);

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
    const newDisposable = currentDisposable + r.monthlyCashflow;
    const totalDTI =
      totalNetIncome > 0 ? ((existingLoanPayments + r.monthlyPmt) / totalNetIncome) * 100 : 0;

    return {
      totalNetIncome,
      currentDisposable,
      newDisposable,
      totalDTI,
    };
  }, [spouses, expenses, loans, globalSettings, r.monthlyCashflow, r.monthlyPmt]);

  const verdictMeta: Record<InvestmentVerdict, { label: string; desc: string; banner: string; icon: typeof CheckCircle2 }> = {
    rentowna:  { label: "Opłacalna inwestycja ✓", desc: "Czynsz pokrywa wszystkie koszty i zostaje Ci nadwyżka co miesiąc. Dobry wynik.", banner: "bg-success/8 border-success/25", icon: CheckCircle2 },
    graniczna: { label: "Na granicy opłacalności", desc: "Czynsz ledwo pokrywa koszty — mała zmiana (rata, pustostan) może spowodować miesięczne dopłaty.", banner: "bg-warning/8 border-warning/25", icon: AlertTriangle },
    kapitalowa:{ label: "Zysk przy sprzedaży", desc: "Co miesiąc dokładasz do interesu, ale mieszkanie zyskuje na wartości — zarobisz głównie przy sprzedaży.", banner: "bg-accent/8 border-accent/25", icon: BarChart2 },
    ryzykowna: { label: "Wysokie ryzyko straty", desc: "Czynsz nie pokrywa kosztów, a mieszkanie drożeje zbyt wolno, żeby to zrekompensować. Rozważ inne opcje.", banner: "bg-destructive/8 border-destructive/25", icon: XCircle },
  };
  const vm = verdictMeta[verdict];
  const VerdictIcon = vm.icon;
  const rentMargin = s.monthlyRent - minRent;
  const rentMarginPct = minRent > 0 ? (rentMargin / minRent) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict Banner */}
      <div className={cn("rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4", vm.banner)}>
        <div className="flex items-start gap-3">
          <VerdictIcon className={cn("w-5 h-5 mt-0.5 shrink-0",
            verdict === "rentowna" ? "text-success" :
            verdict === "graniczna" ? "text-warning-foreground" :
            verdict === "kapitalowa" ? "text-accent" : "text-destructive"
          )} />
          <div>
            <p className={cn("text-sm font-bold",
              verdict === "rentowna" ? "text-success" :
              verdict === "graniczna" ? "text-warning-foreground" :
              verdict === "kapitalowa" ? "text-accent" : "text-destructive"
            )}>{vm.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{vm.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 pl-8 sm:pl-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Minimalny czynsz</p>
            <p className="font-mono font-bold text-sm">{formatPLN(minRent)}<span className="text-xs font-normal text-muted-foreground">/mies.</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Twój margines</p>
            <p className={cn("font-mono font-bold text-sm", rentMargin >= 0 ? "text-success" : "text-destructive")}>
              {rentMargin >= 0 ? "+" : ""}{formatPLN(rentMargin)}
              <span className={cn("text-[10px] ml-1 font-normal", rentMarginPct >= 0 ? "text-success" : "text-destructive")}>
                ({rentMarginPct >= 0 ? "+" : ""}{rentMarginPct.toFixed(0)}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cn(
          "relative overflow-hidden rounded-3xl border border-border p-6 shadow-warm transition-all col-span-2 lg:col-span-1",
          cashflowPositive ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
        )}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Pieniądze na rękę</p>
          <h2 className={cn("font-display text-4xl sm:text-5xl tracking-tight", cashflowPositive ? "text-success" : "text-destructive")}>
            {formatPLN2(r.monthlyCashflow)}
          </h2>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {cashflowPositive ? "miesięcznie ✓" : "dopłata miesięcznie"}
          </p>
          <div className={cn("absolute -right-3 -bottom-3 w-20 h-20 opacity-10", cashflowPositive ? "text-success" : "text-destructive")}>
            <Wallet className="w-full h-full" />
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border p-6 shadow-card flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Zysk roczny (IRR)</p>
          <h2 className="font-display text-3xl text-accent">{r.irrAnnualPct.toFixed(1)}%</h2>
          <p className="text-xs text-muted-foreground mt-2">Uwzględnia wzrost wartości</p>
        </div>

        <div className="bg-card rounded-3xl border border-border p-6 shadow-card flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Opłacalność gotówki</p>
          <h2 className="font-display text-3xl text-foreground">{r.cashOnCashPct.toFixed(1)}%</h2>
          <p className="text-xs text-muted-foreground mt-2">Zysk z wyłożonej gotówki</p>
        </div>

        <div className="bg-card rounded-3xl border border-border p-6 shadow-card flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Rentowność netto</p>
          <h2 className="font-display text-3xl text-foreground">{r.netYieldPct.toFixed(2)}%</h2>
          <p className="text-xs text-muted-foreground mt-2">
            {r.netYieldPct >= 5 ? "✓ Dobry poziom (≥5%)" : r.netYieldPct >= 4 ? "OK (≥4%" : "Poniżej 4%"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px,1fr] gap-8 items-start">
        {/* Left Column: Inputs Accordion */}
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={["item-1"]} className="space-y-4">
            <AccordionItem value="item-1" className="bg-card border border-border rounded-2xl px-6 py-1 shadow-card overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-none">Zakup i remont</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      Gotówka na start: <span className="text-foreground">{formatPLN(r.totalUpfront)}</span>
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-5 border-t border-border/50 mt-2">
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
                  format={(v) => `${v}% (${formatPLN((s.purchasePrice * v) / 100)})`}
                  onChange={(v) => setS({ ...s, downPaymentPct: v })}
                />
                <NumField
                  label="Remont / wykończenie"
                  value={s.renovationCost}
                  onChange={(v) => setS({ ...s, renovationCost: v })}
                />
                <div>
                  <SliderField
                    label="Koszty transakcyjne"
                    value={s.closingCostsPct}
                    min={0}
                    max={10}
                    step={0.5}
                    format={(v) => `${v}% (${formatPLN((s.purchasePrice * v) / 100)})`}
                    onChange={(v) => setS({ ...s, closingCostsPct: v })}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setS({ ...s, closingCostsPct: 2 })}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent/20 transition-colors font-bold"
                    >Wtórny (2%)</button>
                    <button
                      onClick={() => setS({ ...s, closingCostsPct: 0.5 })}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent/20 transition-colors font-bold"
                    >Pierwotny (0.5%)</button>
                    <button
                      onClick={() => setS({ ...s, closingCostsPct: 5 })}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent/20 transition-colors font-bold"
                    >Z agencją (~5%)</button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card border border-border rounded-2xl px-6 py-1 shadow-card overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-none">Finansowanie</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      Rata: <span className="text-foreground">{formatPLN2(r.monthlyPmt)}</span>
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-5 border-t border-border/50 mt-2">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setS({ ...s, mortgageType: "equal" })}
                    className={`text-[11px] py-2 px-3 rounded-lg transition-all ${s.mortgageType === "equal"
                        ? "bg-card text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    Raty równe
                  </button>
                  <button
                    type="button"
                    onClick={() => setS({ ...s, mortgageType: "decreasing" })}
                    className={`text-[11px] py-2 px-3 rounded-lg transition-all ${s.mortgageType === "decreasing"
                        ? "bg-card text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    Raty malejące
                  </button>
                </div>

                <SliderField
                  label="Oprocentowanie roczne"
                  value={s.mortgageRatePct}
                  min={2}
                  max={12}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}%`}
                  onChange={(v) => setS({ ...s, mortgageRatePct: v })}
                />
                <SliderField
                  label="Okres kredytowania"
                  value={s.mortgageYears}
                  min={5}
                  max={35}
                  step={1}
                  format={(v) => `${v} lat`}
                  onChange={(v) => setS({ ...s, mortgageYears: v })}
                />
                <NumField
                  label="Ubezpieczenie miesięczne"
                  value={s.mortgageInsuranceMonthly}
                  onChange={(v) => {
                    setIsInsuranceManual(true);
                    setS({ ...s, mortgageInsuranceMonthly: v });
                  }}
                  hint={!isInsuranceManual && s.purchasePrice > 0 ? "Sugerowane: 0.04% kapitału (miesięcznie)" : undefined}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card border border-border rounded-2xl px-6 py-1 shadow-card overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-none">Wynajem i koszty</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      Zysk co miesiąc: <span className="text-foreground">{formatPLN2(r.monthlyCashflow)}</span>
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-5 border-t border-border/50 mt-2">
                <NumField
                  label="Czynsz od najemcy"
                  value={s.monthlyRent}
                  onChange={(v) => setS({ ...s, monthlyRent: v })}
                  hint="Czynsz najmu + media"
                />

                <div className="space-y-4 p-4 bg-muted/20 rounded-xl border border-border/50">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Rozliczenie kosztów</p>
                  <NumField
                    label="Czynsz admin. / media"
                    value={costs.admin}
                    onChange={(v) => setCosts({ ...costs, admin: v })}
                  />
                  <NumField
                    label="Ubezpieczenie / fundusz"
                    value={costs.insurance}
                    onChange={(v) => setCosts({ ...costs, insurance: v })}
                  />
                  <NumField
                    label="Rezerwa na naprawy"
                    value={costs.reserve}
                    onChange={(v) => setCosts({ ...costs, reserve: v })}
                  />
                  <div className="pt-2 border-t border-border/50 flex justify-between items-baseline">
                    <span className="text-xs font-bold">Łącznie koszty:</span>
                    <span className="font-mono font-bold text-sm">{formatPLN(s.monthlyCosts)}</span>
                  </div>
                </div>

                <SliderField
                  label="Pustostany (rezerwa)"
                  value={s.vacancyRatePct}
                  min={0}
                  max={30}
                  step={1}
                  format={(v) => `${v}% (~${Math.round(v * 3.65)} dni/rok)`}
                  onChange={(v) => setS({ ...s, vacancyRatePct: v })}
                />

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">Podatek (Ryczałt)</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setS({ ...s, taxRatePct: 8.5 })}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg border font-bold transition-all",
                        s.taxRatePct === 8.5 ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"
                      )}
                    >8.5%</button>
                    <button
                      onClick={() => setS({ ...s, taxRatePct: 12.5 })}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg border font-bold transition-all",
                        s.taxRatePct === 12.5 ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted"
                      )}
                    >12.5%</button>
                  </div>
                  <SliderField
                    label="Inna stawka"
                    value={s.taxRatePct}
                    min={0}
                    max={32}
                    step={0.5}
                    format={(v) => `${v}%`}
                    onChange={(v) => setS({ ...s, taxRatePct: v })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card border border-border rounded-2xl px-6 py-1 shadow-card overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg leading-none">Prognoza długoterminowa</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      Horyzont: <span className="text-foreground">{s.holdingYears} lat</span>
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-5 border-t border-border/50 mt-2">
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
                  label="Wzrost wartości rocznie"
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: Visualizations and Reports */}
        <div className="grid xl:grid-cols-2 gap-6 items-start">
          {/* Right Column - Left Split */}
          <div className="space-y-6">
            <CashflowWaterfall r={r} s={s} minRent={minRent} />

            <div className="bg-muted/30 rounded-3xl p-6 border border-border/50">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-4 px-1">Wskaźniki rentowności</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
                <MiniStat
                  label="Rentowność netto"
                  value={`${r.netYieldPct.toFixed(2)}%`}
                  badge={r.netYieldPct >= 5 ? "✓ dobry" : r.netYieldPct >= 4 ? "ok" : "słaby"}
                  badgeTone={r.netYieldPct >= 5 ? "success" : r.netYieldPct >= 4 ? "warning" : "destructive"}
                  hint="Dobry: ≥5%"
                />
                <MiniStat
                  label="Zwrot gotówki (lata)"
                  value={r.breakEvenMonths > 0 ? `${(r.breakEvenMonths / 12).toFixed(1)} lat` : "—"}
                  hint={r.breakEvenMonths <= 0 ? "Ujemny CF — brak zwrotu z czynszów" : undefined}
                />
                <MiniStat
                  label="Rentowność brutto"
                  value={`${r.grossYieldPct.toFixed(2)}%`}
                  hint="Bez kosztów i podatku"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-6">
              <div className="bg-card rounded-3xl p-6 border border-border shadow-card">
                <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Podsumowanie ({s.holdingYears} lat)
                </h3>
                
                <div className="mb-4">
                  {r.monthlyCashflow < 0 ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-normal text-left leading-tight">
                      Strategia: Budowanie kapitału / Dopłaty
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-normal text-left leading-tight">
                      Strategia: Dochód pasywny / Rentierska
                    </Badge>
                  )}
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground font-medium">Zysk z wynajmu</span>
                    <span className={cn("font-mono font-bold", r.totalCashflow >= 0 ? "text-success" : "text-destructive")}>
                      {r.totalCashflow >= 0 ? "+" : ""}{formatPLN(r.totalCashflow)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground font-medium">Wzrost wartości</span>
                    <span className="font-mono font-bold text-success">
                      +{formatPLN(r.yearly[r.yearly.length - 1].propertyValue - s.purchasePrice)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-lg">Zysk końcowy</span>
                    <div className="text-right">
                      <p className={cn("font-display text-2xl leading-none", r.totalReturn >= 0 ? "text-success" : "text-destructive")}>
                        {formatPLN(r.totalReturn)}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">
                        ROI: {r.totalReturnPct.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6 border border-border shadow-card">
                <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  Kredyt ({s.holdingYears} lat)
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground font-medium">Zapłacone odsetki</span>
                    <span className="font-mono font-bold text-destructive">-{formatPLN(r.totalInterestPaid)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground font-medium">Dług na koniec</span>
                    <span className="font-mono font-bold">
                      {formatPLN(r.yearly[r.yearly.length - 1].loanBalance)}
                    </span>
                  </div>
                  <Separator />
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pożyczasz <span className="font-bold text-foreground">{formatPLN(r.loanAmount)}</span> na {s.mortgageYears} lat.
                      Spłacono już <span className="font-bold text-success">{formatPLN(r.loanAmount - r.yearly[r.yearly.length - 1].loanBalance)}</span> kapitału.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Right Split */}
          <div className="space-y-6">
            <WiborSensitivityStrip data={wiborData} currentRate={s.mortgageRatePct} />

            <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-card">
              <h3 className="font-display text-xl mb-1">Twój majątek w czasie</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Zobacz, jak rośnie wartość Twojej części mieszkania i ile zarabiasz na wynajmie.
              </p>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer>
                  <LineChart data={r.yearly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.015 85)" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 10, fontWeight: 500 }}
                      unit="r"
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => formatPLN(v)}
                      labelFormatter={(y) => `Rok ${y}`}
                      contentStyle={{ fontSize: 12, borderRadius: 16, border: 'none', boxShadow: 'var(--shadow-elevated)' }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingBottom: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      name="Twoja część mieszkania"
                      stroke="var(--color-success)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeCashflow"
                      name="Suma zysków"
                      stroke="var(--color-accent)"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-6 sm:p-8 border border-accent/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Wallet className="w-24 h-24 text-accent" />
              </div>

              <h3 className="font-display text-2xl mb-6 flex items-center gap-2 text-accent relative z-10">
                Wpływ na domowy budżet
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Zostaje w portfelu</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-display font-bold">
                      {formatPLN(budgetImpact.newDisposable)}
                    </p>
                    <span className={cn("text-xs font-bold", r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>
                      ({r.monthlyCashflow >= 0 ? "+" : ""}{formatPLN(r.monthlyCashflow)})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Tyle zostanie na życie po opłaceniu wydatków.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Zdolność do oszczędzania</p>
                  <p className="text-3xl font-display font-bold">
                    {budgetImpact.totalNetIncome > 0
                      ? ((budgetImpact.newDisposable / budgetImpact.totalNetIncome) * 100).toFixed(0)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Procent pensji, który wciąż możesz odkładać.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-background/50 backdrop-blur-sm rounded-2xl border border-accent/10 text-sm text-muted-foreground italic relative z-10">
                {`"Przy dochodach ${formatPLN(budgetImpact.totalNetIncome)} miesięcznie, ta inwestycja`}
                {r.monthlyCashflow >= 0
                  ? ` poprawia Twoją nadwyżkę o ${((r.monthlyCashflow / budgetImpact.totalNetIncome) * 100).toFixed(1)}%."`
                  : ` obciąża Twój budżet o ${Math.abs((r.monthlyCashflow / budgetImpact.totalNetIncome) * 100).toFixed(1)}%."`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CASHFLOW WATERFALL
============================================================ */
function CashflowWaterfall({ r, s, minRent }: { r: any; s: any; minRent: number }) {
  const steps = [
    { label: "Czynsz brutto", value: s.monthlyRent, tone: "accent" as const },
    { label: "Pustostany", value: -(s.monthlyRent * (s.vacancyRatePct / 100)), tone: "muted" as const },
    { label: "Koszty stałe", value: -s.monthlyCosts, tone: "muted" as const },
    { label: "Rata kredytu", value: -r.monthlyPmt, tone: "destructive" as const },
    { label: "Ubezpieczenie", value: -s.mortgageInsuranceMonthly, tone: "destructive" as const },
    { label: "Podatek", value: -r.monthlyTax, tone: "warning" as const },
  ];

  const totalWidth = s.monthlyRent;
  const result = r.monthlyCashflow;

  return (
    <div className="bg-card rounded-3xl p-8 border border-border shadow-card space-y-6">
      <div>
        <h3 className="font-display text-xl mb-1">Analiza przepływów (m-c)</h3>
        <p className="text-xs text-muted-foreground">Gdzie uciekają Twoje pieniądze każdego miesiąca?</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          if (step.value === 0) return null;
          const absVal = Math.abs(step.value);
          const pct = (absVal / totalWidth) * 100;

          return (
            <div key={i} className="group flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{step.label}</span>
                <span className={cn(
                  "font-mono text-sm font-bold",
                  step.value < 0 ? "text-destructive" : "text-accent"
                )}>
                  {step.value > 0 ? "+" : ""}{formatPLN(step.value)}
                </span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    step.tone === "accent" ? "bg-accent" :
                      step.tone === "destructive" ? "bg-destructive/60" :
                        step.tone === "warning" ? "bg-warning" : "bg-muted-foreground/40"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-border/50">
          <div className="flex justify-between items-center">
            <span className="font-display text-lg">Wynik netto (CF)</span>
            <div className="text-right">
              <p className={cn(
                "font-display text-2xl font-bold leading-none",
                result >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatPLN(result)}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">miesięcznie</p>
            </div>
          </div>
        </div>

        {/* Min-rent tip */}
        <div className={cn(
          "rounded-xl px-4 py-3 border text-xs flex items-start gap-2.5",
          s.monthlyRent >= minRent
            ? "bg-success/6 border-success/20 text-success"
            : "bg-destructive/6 border-destructive/20 text-destructive"
        )}>
          <span className="mt-0.5 shrink-0">{s.monthlyRent >= minRent ? "✓" : "⚠"}</span>
          <span>
            {s.monthlyRent >= minRent ? (
              <>
                Twój czynsz to <strong>{formatPLN(s.monthlyRent)}</strong>. Żeby wyjść na zero z tą inwestycją, 
                musisz wziąć co najmniej <strong>{formatPLN(minRent)}</strong> od najemcy. 
                (Masz {(((s.monthlyRent - minRent) / minRent) * 100).toFixed(0)}% marginesu błędu).
              </>
            ) : (
              <>
                Twój czynsz to <strong>{formatPLN(s.monthlyRent)}</strong>, a żeby wyjść na zero, 
                musisz wziąć co najmniej <strong>{formatPLN(minRent)}</strong> od najemcy.
                (Brakuje Ci {formatPLN(minRent - s.monthlyRent)}).
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   WIBOR / STOPY PROCENTOWE — SENSITIVITY STRIP
============================================================ */
function WiborSensitivityStrip({
  data,
  currentRate,
}: {
  data: WiborScenario[];
  currentRate: number;
}) {
  const current = data.find((d) => d.rateDelta === 0);
  return (
    <div className="bg-card rounded-3xl p-6 border border-border shadow-card space-y-4">
      <div>
        <h3 className="font-display text-xl mb-0.5 flex items-center gap-2">
          <Zap className="w-4 h-4 text-warning-foreground" />
          Wrażliwość na zmiany stóp (WIBOR)
        </h3>
        <p className="text-xs text-muted-foreground">
          Twoja hipoteka to rata zmienna (WIBOR + marża banku = {currentRate.toFixed(1)}%). Zobacz,
          jak zmiana stóp NBP wpłynie na Twoją ratę i rentowność.
        </p>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold pr-3">Stopa</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2">Rata</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2">Δ Raty</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2">CF/mies.</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold pl-2">Δ CF</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isCurrent = row.rateDelta === 0;
              const cfPositive = row.monthlyCashflow >= 0;
              return (
                <tr
                  key={row.rateDelta}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    isCurrent && "bg-accent/6"
                  )}
                >
                  <td className="py-2.5 pr-3 font-mono font-bold">
                    <span className={isCurrent ? "text-accent" : "text-foreground"}>
                      {row.ratePct.toFixed(1)}%
                    </span>
                    {isCurrent && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-widest text-accent font-bold">teraz</span>
                    )}
                    {row.rateDelta !== 0 && (
                      <span className={cn(
                        "ml-1.5 text-[9px] font-bold",
                        row.rateDelta > 0 ? "text-destructive" : "text-success"
                      )}>
                        ({row.rateDelta > 0 ? "+" : ""}{row.rateDelta}pp)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">{formatPLN(row.monthlyPmt)}</td>
                  <td className={cn(
                    "py-2.5 px-2 text-right font-mono font-bold",
                    row.pmtDelta > 0 ? "text-destructive" : row.pmtDelta < 0 ? "text-success" : "text-muted-foreground"
                  )}>
                    {row.pmtDelta === 0 ? "—" : `${row.pmtDelta > 0 ? "+" : ""}${formatPLN(row.pmtDelta)}`}
                  </td>
                  <td className={cn(
                    "py-2.5 px-2 text-right font-mono font-bold",
                    cfPositive ? "text-success" : "text-destructive"
                  )}>
                    {formatPLN(row.monthlyCashflow)}
                  </td>
                  <td className={cn(
                    "py-2.5 pl-2 text-right font-mono font-bold",
                    row.cashflowDelta > 0 ? "text-success" : row.cashflowDelta < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {row.cashflowDelta === 0 ? "—" : `${row.cashflowDelta > 0 ? "+" : ""}${formatPLN(row.cashflowDelta)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {current && (
        <p className="text-[10px] text-muted-foreground italic px-1">
          * Symulacja zakłada stałą marżę banku. Zmiana WIBOR o +1pp
          = zmiana raty o ok. {formatPLN(Math.abs(data.find(d => d.rateDelta === 1)?.pmtDelta ?? 0))}.
        </p>
      )}
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
