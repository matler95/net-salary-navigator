import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  TrendingUp,
  Wallet,
  Landmark,
  ShoppingBag,
  CreditCard,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Banknote,
  PiggyBank,
  ShieldPlus,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  LineChart,
  Line,
} from "recharts";
import { useAppState } from "@/lib/store";
import {
  calculateSalary,
  calculateAnnualAverageNet,
  calculateAnnualBreakdown,
  calculateSalaryForMonth,
  computeJointFiling,
  formatPLN,
  formatPLN2,
} from "@/lib/salary";
import {
  rentalCashflow,
  monthlyPayment,
  getExpenseMonthlyAverage,
  isExpenseInMonth,
} from "@/lib/finance";
import { convertToPLN, useDailyFxRates } from "@/lib/fx";
import { getInvestmentCurrentValue, useDailyTickerPrices } from "@/lib/market";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Przegląd — Saldeo" },
      {
        name: "description",
        content: "Przegląd budżetu gospodarstwa: dochody, wydatki, aktywa, oszczędności.",
      },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--accent)",
  "oklch(0.62 0.14 148)",
  "oklch(0.74 0.13 75)",
  "oklch(0.58 0.19 25)",
  "oklch(0.52 0.018 210)",
  "oklch(0.80 0.12 180)",
];

function Dashboard() {
  const { session } = useAuthSession();
  const spouses = useAppState((s) => s.spouses);
  const expenses = useAppState((s) => s.expenses);
  const investments = useAppState((s) => s.investments);
  const loans = useAppState((s) => s.loans);
  const rentals = useAppState((s) => s.rentals);
  const savings = useAppState((s) => s.savings);
  const globalSettings = useAppState((s) => s.globalSettings);
  const { rates } = useDailyFxRates();
  const { prices: tickerPrices } = useDailyTickerPrices(investments.map((i) => i.ticker ?? ""));

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(() => new Date().getMonth() + 1);

  const isCompletelyEmpty =
    spouses.length === 0 &&
    expenses.length === 0 &&
    investments.length === 0 &&
    loans.length === 0 &&
    rentals.length === 0 &&
    savings.length === 0;

  // -- Core calcs
  const breakdowns = useMemo(
    () => spouses.map((s) => ({ spouse: s, r: calculateSalary(s.inputs, 0, globalSettings) })),
    [spouses, globalSettings],
  );

  const totalAnnualAvgNet = useMemo(() =>
    spouses.reduce((sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings), 0),
    [spouses, globalSettings]
  );

  const totalSelectedMonthNet = useMemo(() =>
    spouses.reduce((sum, s) => sum + calculateSalaryForMonth(s.inputs, selectedMonthIdx, globalSettings).net, 0),
    [spouses, selectedMonthIdx, globalSettings]
  );

  const totalExpenses = expenses.reduce((s, e) => s + getExpenseMonthlyAverage(e), 0);
  const totalInvestments = investments.reduce(
    (s, i) => s + convertToPLN(getInvestmentCurrentValue(i, tickerPrices), i.currency, rates),
    0,
  );
  const totalLoans = loans.reduce((s, l) => s + l.principal, 0);
  const monthlyLoanPmt = loans.reduce(
    (s, l) =>
      s +
      monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining) +
      (l.monthlyOverpayment ?? 0) +
      (l.mortgageInsuranceMonthly ?? 0),
    0,
  );
  const rentalNet = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);
  const rentalAssets = rentals.reduce((s, r) => s + r.marketValue, 0);
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0);

  const getExpensesForMonth = (mIdx: number) => {
    return expenses.reduce((sum, e) => {
      if (isExpenseInMonth(e, mIdx)) return sum + e.amount;
      return sum;
    }, 0);
  };
  const selectedMonthExpenses = getExpensesForMonth(selectedMonthIdx);

  const selectedMonthCashflow = totalSelectedMonthNet + rentalNet - selectedMonthExpenses - monthlyLoanPmt;

  const nextMonthIdx = selectedMonthIdx === 12 ? 1 : selectedMonthIdx + 1;
  const nextMonthNet = useMemo(() =>
    spouses.reduce((sum, s) => sum + calculateSalaryForMonth(s.inputs, nextMonthIdx, globalSettings).net, 0),
    [spouses, nextMonthIdx, globalSettings]
  );
  const nextMonthCashflow = nextMonthNet + rentalNet - getExpensesForMonth(nextMonthIdx) - monthlyLoanPmt;
  const totalAssets = totalInvestments + rentalAssets + totalSavings;
  const netWorth = totalAssets - totalLoans;
  const emergencyFundMonths = totalExpenses > 0 ? totalSavings / totalExpenses : 0;

  // -- Charts Data
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) =>
      map.set(e.category, (map.get(e.category) || 0) + getExpenseMonthlyAverage(e)),
    );
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [expenses]);

  const projection = useMemo(() => {
    const annualBreakdowns = spouses.map((s) => calculateAnnualBreakdown(s.inputs, globalSettings));
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const point: Record<string, number | string> = { month: monthLabel(month) };
      spouses.forEach((spouse, sIdx) => {
        const cumulative = annualBreakdowns[sIdx]
          .slice(0, month)
          .reduce((sum: number, m: any) => sum + m.taxBase, 0);
        point[spouse.name] = Math.round(cumulative);
      });
      return point;
    });
  }, [spouses, globalSettings]);

  const [includeSavings, setIncludeSavings] = useState(true);
  const [includeInvestments, setIncludeInvestments] = useState(false);

  const cumulativeData = useMemo(() => {
    const annualBreakdowns = spouses.map((s) => calculateAnnualBreakdown(s.inputs, globalSettings));
    let cumulativeSurplus = 0;

    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const monthlyNet = annualBreakdowns.reduce((sum, b) => sum + b[idx].net, 0);
      const mExpenses = expenses.reduce((sum, e) => (isExpenseInMonth(e, month) ? sum + e.amount : sum), 0);
      const mCashflow = monthlyNet + rentalNet - mExpenses - monthlyLoanPmt;
      cumulativeSurplus += mCashflow;
      const growthFactor = includeInvestments ? Math.pow(1.005, idx) : 1;
      return {
        month: monthLabel(month),
        "Suma nadwyżek": Math.round(cumulativeSurplus),
        "Konta bankowe": includeSavings ? totalSavings : 0,
        "Inwestycje": includeInvestments ? Math.round(totalInvestments * growthFactor) : 0,
        "Wartość": Math.round(cumulativeSurplus + (includeSavings ? totalSavings : 0) + (includeInvestments ? totalInvestments * growthFactor : 0)),
      };
    });
  }, [spouses, expenses, rentalNet, monthlyLoanPmt, includeSavings, includeInvestments, totalSavings, totalInvestments, globalSettings]);

  // -- 7-month sparkline for cashflow
  const cashflowSparkline = useMemo(() => {
    const annualBreakdowns = spouses.map((s) => calculateAnnualBreakdown(s.inputs, globalSettings));
    return Array.from({ length: 7 }, (_, i) => {
      // Current month + up to 6 months ahead (looping around year if needed, but for simplicity we'll just do 1-12 based)
      // Actually let's just show Jan-Jul or the last 7 months of projection.
      // Better: let's show months around selectedMonth.
      let m = selectedMonthIdx - 3 + i;
      if (m < 1) m += 12;
      if (m > 12) m -= 12;
      const monthlyNet = annualBreakdowns.reduce((sum, b) => sum + b[m - 1].net, 0);
      const mExp = expenses.reduce((sum, e) => (isExpenseInMonth(e, m) ? sum + e.amount : sum), 0);
      const cf = monthlyNet + rentalNet - mExp - monthlyLoanPmt;
      return { name: monthLabel(m), val: cf };
    });
  }, [selectedMonthIdx, spouses, expenses, rentalNet, monthlyLoanPmt, globalSettings]);

  const thresholdDates = useMemo(() => {
    return spouses.map((s) => {
      const breakdown = calculateAnnualBreakdown(s.inputs, globalSettings);
      let cumulative = 0;
      let monthIndex = -1;
      for (let i = 0; i < 12; i++) {
        cumulative += breakdown[i].taxBase;
        if (cumulative > 120000) {
          monthIndex = i;
          break;
        }
      }
      return { id: s.id, name: s.name, monthIndex };
    });
  }, [spouses, globalSettings]);

  if (isCompletelyEmpty) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
        <div className="mx-auto max-w-2xl bg-card rounded-[2rem] border border-border p-8 md:p-12 shadow-warm text-center animate-fade-up">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-accent/10 font-display text-5xl font-bold italic text-accent shadow-sm">
            S
          </div>
          <h1 className="font-display text-3xl md:text-4xl mb-4 text-foreground">
            Zacznij od zarobków
          </h1>
          <p className="text-muted-foreground md:text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Wpisz swoje wynagrodzenie brutto, a Saldeo wyliczy co zostaje w kieszeni i pomoże zaplanować domowy budżet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <div className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-accent-foreground">1</span>
              Zarobki
            </div>
            <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground/50" />
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px]">2</span>
              Wydatki
            </div>
            <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground/50" />
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px]">3</span>
              Majątek
            </div>
          </div>

          <Link
            to="/wynagrodzenia"
            className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-full bg-accent-gradient px-8 text-base font-semibold text-accent-foreground shadow-warm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Rozpocznij planowanie
          </Link>
        </div>
      </main>
    );
  }

  const userNickname = session?.user.user_metadata?.nickname?.trim();
  const greetingName = userNickname || session?.user.email?.split("@")[0] || "użytkowniku";

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fade-up">
      {/* A) HERO SECTION */}
      <section className="bg-card rounded-2xl p-6 sm:p-8 shadow-elevated border border-border">
        <div className="flex flex-col gap-6">
          {/* Header row with greeting and month navigator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 font-display text-lg font-bold italic text-accent">
                S
              </div>
              <p className="font-display text-xl italic text-foreground/80">
                {greeting()}, {greetingName}!
              </p>
            </div>

            <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-1">
              <button
                onClick={() => setSelectedMonthIdx((m) => (m === 1 ? 12 : m - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Poprzedni miesiąc"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-3 text-xs font-bold w-28 text-center text-foreground uppercase tracking-wider">
                {monthLabel(selectedMonthIdx, false)}
              </div>
              <button
                onClick={() => setSelectedMonthIdx((m) => (m === 12 ? 1 : m + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Następny miesiąc"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left: Monthly Outcome */}
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  {selectedMonthCashflow >= 0 ? "Zysk miesiąca" : "Strata miesiąca"}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-end gap-6">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <p className={cn("font-display text-5xl tracking-tight animate-count-up tabular-nums", selectedMonthCashflow >= 0 ? "text-income" : "text-expense")}>
                        {selectedMonthCashflow > 0 ? "+" : ""}{formatPLN(selectedMonthCashflow).replace(" zł", "")}
                        <span className="text-xl ml-1">zł</span>
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1.5 opacity-80">
                      W przyszłym miesiącu: <span className={cn("font-mono", nextMonthCashflow >= 0 ? "text-success" : "text-destructive")}>
                        {nextMonthCashflow > 0 ? "+" : ""}{formatPLN(nextMonthCashflow)}
                      </span>
                    </p>
                  </div>
                  <div className="h-16 w-full max-w-[240px] opacity-80 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cashflowSparkline}>
                        <XAxis
                          dataKey="name"
                          hide={false}
                          tickFormatter={(value) => value.split(" ")[0]} // "Lip 2026" → "Lip"
                          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          dy={4}
                        />
                        <Tooltip
                          formatter={(v: number) => [formatPLN(v), "zysk"]}
                          contentStyle={{
                            fontSize: "10px",
                            borderRadius: "10px",
                            border: "1px solid var(--border)",
                            boxShadow: "var(--shadow-warm)",
                            backgroundColor: "var(--background)",
                            padding: "4px 8px",
                          }}
                          labelStyle={{ fontWeight: "bold", color: "var(--foreground)", marginBottom: "2px" }}
                          itemStyle={{ padding: 0 }}
                          cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="val"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
                        />
                        <YAxis hide domain={["auto", "auto"]} />
                        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Consolidated Monthly Stats - LAYOUT PRESERVED */}
              <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dochody</p>
                  <p className="font-mono text-sm font-bold text-income">{formatPLN(totalSelectedMonthNet + rentalNet)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Wydatki (mies.)</p>
                  <p className="font-mono text-sm font-bold text-expense">{formatPLN(selectedMonthExpenses)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Raty kredytów</p>
                  <p className="font-mono text-sm font-bold text-debt">{formatPLN(monthlyLoanPmt)}</p>
                </div>
              </div>
            </div>

            {/* Right: Wealth Status */}
            <div className="space-y-6">

              {/* Integrated Wealth Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 p-4 border border-border group hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Landmark className="h-3.5 w-3.5 text-accent" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aktywa razem</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">{formatPLN(totalAssets)}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 border border-border group hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-debt" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Zadłużenie</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">{formatPLN(totalLoans)}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 border border-border group hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldPlus className={cn("h-3.5 w-3.5", emergencyFundMonths >= globalSettings.targetEmergencyFundMonths ? "text-success" : "text-orange-500")} />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Poduszka</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {emergencyFundMonths.toFixed(1)} / {globalSettings.targetEmergencyFundMonths} <span className="text-[10px] font-normal text-muted-foreground ml-0.5">m-cy</span>
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-4 border border-border group hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-income" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Średni dochód</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-foreground">{formatPLN(totalAnnualAvgNet)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* E) CHARTS SECTION */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Tax threshold chart */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
          <h2 className="font-display text-xl mb-1 gradient-text font-bold">Zarobki vs II próg podatkowy</h2>
          <p className="text-sm text-muted-foreground mb-6">Skumulowana roczna podstawa (120k zł)</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={projection}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} dx={-8} />
                <Tooltip
                  formatter={(v: number) => formatPLN(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-warm)" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" />
                <ReferenceLine
                  y={120000}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                  label={{ value: "II próg (120k)", fontSize: 10, fill: "var(--destructive)", position: "insideTopLeft" }}
                />
                {breakdowns.map(({ spouse }, idx) => (
                  <Bar
                    key={spouse.id}
                    dataKey={spouse.name}
                    fill={idx === 0 ? "url(#barGradient)" : CHART_COLORS[idx % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap gap-x-4 gap-y-2">
            {thresholdDates.map((td) => (
              <div key={td.id} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <p className="text-[10px] leading-none text-muted-foreground">
                  <span className="font-bold text-foreground">{td.name}</span>:{" "}
                  {td.monthIndex === -1
                    ? "pozostaje w I progu"
                    : `wpada w II próg w ${monthLabel(td.monthIndex + 1).split(" ")[0]}`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expense breakdown pie */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
          <h2 className="font-display text-xl mb-1 gradient-text font-bold">Struktura wydatków</h2>
          <p className="text-sm text-muted-foreground mb-6">Miesięcznie: {formatPLN2(totalExpenses)}</p>
          {byCategory.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">Brak wydatków</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {byCategory.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatPLN(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-warm)" }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* F) SAVINGS PROJECTION CHART */}
      <section className="bg-card rounded-2xl p-6 border border-border shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl mb-1 gradient-text font-bold">Projekcja budżetu</h2>
            <p className="text-sm text-muted-foreground">Skumulowane oszczędności do końca roku</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIncludeSavings(!includeSavings)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                includeSavings ? "bg-success/15 text-success" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Landmark className="h-3.5 w-3.5" /> Gotówka
            </button>
            <button
              onClick={() => setIncludeInvestments(!includeInvestments)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                includeInvestments ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Giełda
            </button>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} dx={-8} />
              <Tooltip
                formatter={(v: number) => formatPLN(v)}
                contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-warm)" }}
              />
              <Area
                type="monotone"
                dataKey="Wartość"
                stroke="var(--accent)"
                fillOpacity={1}
                fill="url(#colorValue)"
                strokeWidth={3}
                activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* G) QUICK LINKS */}
      <section className="grid sm:grid-cols-3 gap-4">
        <Link
          to="/wynagrodzenia"
          className="group relative overflow-hidden rounded-2xl bg-card p-6 border border-border shadow-card card-hover"
        >
          <div className="absolute -right-4 -top-4 rounded-full bg-accent/5 p-8 transition-transform group-hover:scale-110">
            <Banknote className="h-10 w-10 text-accent/20" />
          </div>
          <div className="relative z-10">
            <p className="font-display text-lg font-bold mb-1 transition-colors group-hover:text-accent flex items-center gap-2">
              Zarobki <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dodaj domowników i sprawdź dokładnie, co wchodzi w skład Waszych pensji netto.
            </p>
          </div>
        </Link>
        <Link
          to="/wydatki"
          className="group relative overflow-hidden rounded-2xl bg-card p-6 border border-border shadow-card card-hover"
        >
          <div className="absolute -right-4 -top-4 rounded-full bg-destructive/5 p-8 transition-transform group-hover:scale-110">
            <ShoppingBag className="h-10 w-10 text-destructive/20" />
          </div>
          <div className="relative z-10">
            <p className="font-display text-lg font-bold mb-1 transition-colors group-hover:text-destructive flex items-center gap-2">
              Wydatki <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kategoryzuj koszty życia i miej pełną kontrolę nad tym, gdzie uciekają pieniądze.
            </p>
          </div>
        </Link>
        <Link
          to="/aktywa"
          className="group relative overflow-hidden rounded-2xl bg-card p-6 border border-border shadow-card card-hover"
        >
          <div className="absolute -right-4 -top-4 rounded-full bg-success/5 p-8 transition-transform group-hover:scale-110">
            <Landmark className="h-10 w-10 text-success/20" />
          </div>
          <div className="relative z-10">
            <p className="font-display text-lg font-bold mb-1 transition-colors group-hover:text-success flex items-center gap-2">
              Majątek <ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Zarządzaj kontami, kredytami hipotecznymi, mieszkaniami i portfelem ETF.
            </p>
          </div>
        </Link>
      </section>
    </main>
  );
}

function monthLabel(m: number, full = false) {
  const short = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  const long = [
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
  const label = (full ? long : short)[m - 1];
  const year = new Date().getFullYear();
  // If month is in the past (relative to current month), we show the current year.
  // If it's a projection tool, we might need more logic, but for dashboard simple "Styczeń 2025" is better than just "Styczeń".
  return `${label} ${year}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Dzień dobry";
  if (h < 18) return "Cześć";
  return "Dobry wieczór";
}
