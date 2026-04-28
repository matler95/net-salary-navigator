import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
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
  getExpenseAnnualTotal,
  getExpenseMonthlyAverage,
  isExpenseInMonth,
} from "@/lib/finance";
import { convertToPLN, useDailyFxRates } from "@/lib/fx";
import { getInvestmentCurrentValue, useDailyTickerPrices } from "@/lib/market";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulpit — Płaca.netto" },
      {
        name: "description",
        content: "Pulpit budżetu gospodarstwa: dochody, wydatki, aktywa, II próg podatkowy.",
      },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["#c84026", "#e08a3c", "#5b8c5a", "#3a5e8c", "#7a4e8c", "#8c7a4e", "#4e8c8c"];

import { StatCard } from "@/components/ui/stat-card";

function Dashboard() {
  const spouses = useAppState((s) => s.spouses);
  const jointFiling = useAppState((s) => s.jointFiling);
  const expenses = useAppState((s) => s.expenses);
  const investments = useAppState((s) => s.investments);
  const loans = useAppState((s) => s.loans);
  const rentals = useAppState((s) => s.rentals);
  const savings = useAppState((s) => s.savings);
  const globalSettings = useAppState((s) => s.globalSettings);
  const { rates } = useDailyFxRates();
  const { prices: tickerPrices } = useDailyTickerPrices(investments.map((i) => i.ticker ?? ""));

  const breakdowns = useMemo(
    () => spouses.map((s) => ({ spouse: s, r: calculateSalary(s.inputs, 0, globalSettings) })),
    [spouses, globalSettings],
  );

  const totalHouseholdNet = spouses.reduce(
    (sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings),
    0,
  );
  const totalGross = breakdowns.reduce((sum, { r }) => sum + r.gross, 0);
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
      (l.monthlyOverpayment ?? 0),
    0,
  );
  const rentalNet = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);
  const rentalAssets = rentals.reduce((s, r) => s + r.marketValue, 0);
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0);
  
  // Advanced Net Salary calculations
  const currentMonthIdx = new Date().getMonth() + 1;
  const nextMonthIdx = currentMonthIdx === 12 ? 1 : currentMonthIdx + 1;
  
  const totalAnnualAvgNet = useMemo(() => 
    spouses.reduce((sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings), 0),
    [spouses, globalSettings]
  );
  
  const totalCurrentMonthNet = useMemo(() => 
    spouses.reduce((sum, s) => sum + calculateSalaryForMonth(s.inputs, currentMonthIdx, globalSettings).net, 0),
    [spouses, currentMonthIdx, globalSettings]
  );
  
  const totalNextMonthNet = useMemo(() => 
    spouses.reduce((sum, s) => sum + calculateSalaryForMonth(s.inputs, nextMonthIdx, globalSettings).net, 0),
    [spouses, nextMonthIdx, globalSettings]
  );

  const getExpensesForMonth = (mIdx: number) => {
    return expenses.reduce((sum, e) => {
      if (isExpenseInMonth(e, mIdx)) {
        return sum + e.amount;
      }
      // If it's a regular frequency but no specific months are set, 
      // we might want to show average as a fallback to avoid "hidden" costs,
      // but the user asked for "correct mirroring". 
      // For now, if isExpenseInMonth is false, we return 0.
      return sum;
    }, 0);
  };

  const annualAvgCashflow = totalAnnualAvgNet + rentalNet - totalExpenses - monthlyLoanPmt;
  const currentMonthCashflow = totalCurrentMonthNet + rentalNet - getExpensesForMonth(currentMonthIdx) - monthlyLoanPmt;
  const nextMonthCashflow = totalNextMonthNet + rentalNet - getExpensesForMonth(nextMonthIdx) - monthlyLoanPmt;

  const netWorth = totalInvestments + rentalAssets + totalSavings - totalLoans;
  const isCompletelyEmpty =
    spouses.length === 0 &&
    expenses.length === 0 &&
    investments.length === 0 &&
    loans.length === 0 &&
    rentals.length === 0 &&
    savings.length === 0;

  // Joint filing comparison
  const joint = spouses.length === 2 ? computeJointFiling(spouses[0].inputs, spouses[1].inputs, globalSettings) : null;

  // Expense breakdown by category
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
  }, [spouses]);

  // Cumulative Cashflow Chart Data
  const cumulativeData = useMemo(() => {
    const annualBreakdowns = spouses.map((s) => calculateAnnualBreakdown(s.inputs, globalSettings));
    let cumulative = 0;

    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const monthlyNet = annualBreakdowns.reduce((sum, b) => sum + b[idx].net, 0);
      
      const monthlyExpenses = expenses.reduce((sum, e) => {
        if (isExpenseInMonth(e, month)) {
          return sum + e.amount;
        }
        return sum;
      }, 0);

      const monthlyCashflow = monthlyNet + rentalNet - monthlyExpenses - monthlyLoanPmt;
      cumulative += monthlyCashflow;

      return {
        month: monthLabel(month),
        "Stan konta (skumulowany)": Math.round(cumulative),
        "Cashflow miesięczny": Math.round(monthlyCashflow),
      };
    });
  }, [spouses, expenses, rentalNet, monthlyLoanPmt]);

  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isCompletelyEmpty) {
      setShowBanner(true);
      return;
    }
    setShowBanner(false);
  }, [isCompletelyEmpty]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {showBanner && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-accent mb-1">Witaj w Płaca.netto!</h3>
            <p className="text-sm text-muted-foreground">
              Zacznij od dodania osoby w <Link to="/wynagrodzenia" className="text-accent underline hover:text-accent/80">Wynagrodzenia</Link>, potem uzupełnij <Link to="/wydatki" className="text-accent underline hover:text-accent/80">Wydatki</Link> i <Link to="/aktywa" className="text-accent underline hover:text-accent/80">Aktywa</Link>.
            </p>
          </div>
          <button
            onClick={() => {
              setShowBanner(false);
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Pulpit gospodarstwa
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          {greeting()}, <span className="italic text-accent">jak idą finanse?</span>
        </h1>
      </header>

      {/* Stats - Current Situation */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Obecne netto"
          value={formatPLN(totalCurrentMonthNet)}
          sub={
            <div className="flex justify-between gap-2">
              <span>{monthLabel(nextMonthIdx, true)}:</span>
              <span>{formatPLN(totalNextMonthNet)}</span>
            </div>
          }
          tone="success"
        />
        <StatCard
          label="Obecny cashflow"
          value={formatPLN(currentMonthCashflow)}
          sub={
            <div className="flex justify-between gap-2">
              <span>{monthLabel(nextMonthIdx, true)}:</span>
              <span className={nextMonthCashflow >= 0 ? "text-success" : "text-destructive"}>
                {formatPLN(nextMonthCashflow)}
              </span>
            </div>
          }
          tone={currentMonthCashflow >= 0 ? "success" : "destructive"}
        />
        <StatCard
          label="Wydatki"
          value={formatPLN(totalExpenses + monthlyLoanPmt)}
          sub={`w tym kredyty ${formatPLN(monthlyLoanPmt)}`}
          tone="destructive"
        />
      </section>

      {/* Stats - Annual Perspective */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Średnie netto (rok)"
          value={formatPLN(totalAnnualAvgNet)}
          sub="Średnia z 12 m-cy"
          tone="success"
        />
        <StatCard
          label="Średni cashflow (rok)"
          value={formatPLN(annualAvgCashflow)}
          sub="Dla planowania budżetu"
          tone={annualAvgCashflow >= 0 ? "success" : "destructive"}
        />
        <StatCard
          label="Majątek netto"
          value={formatPLN(netWorth)}
          sub={`aktywa ${formatPLN(totalInvestments + rentalAssets + totalSavings)}`}
        />
      </section>

      {/* Joint vs individual filing */}
      {/* {joint && (
        <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-display text-2xl">Wspólne vs indywidualne rozliczenie</h2>
              <p className="text-sm text-muted-foreground">
                Roczny PIT (po uwzględnieniu kwoty wolnej 30 000 zł / osoba)
              </p>
            </div>
            <div
              className={`text-right ${joint.savings > 0 ? "text-success" : "text-muted-foreground"}`}
            >
              <p className="text-xs uppercase tracking-wider font-medium">Oszczędność</p>
              <p className="font-display text-2xl tabular-nums">{formatPLN(joint.savings)}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Indywidualnie
              </p>
              <p className="font-display text-2xl mt-1 tabular-nums">
                {formatPLN(joint.individualAnnualPit)}
              </p>
            </div>
            <div
              className={`rounded-xl p-4 ${joint.savings > 0 ? "bg-success/10 border border-success/30" : "bg-muted/40"}`}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Wspólnie</p>
              <p className="font-display text-2xl mt-1 tabular-nums">
                {formatPLN(joint.jointAnnualPit)}
              </p>
            </div>
          </div>
        </section>
      )} */}

      {/* Cumulative Cashflow Chart */}
      <section className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
        <h2 className="font-display text-xl mb-1">Projekcja skumulowanych oszczędności</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Saldo netto narastająco w ciągu roku (dochody - wydatki - kredyty)
        </p>
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => formatPLN(v)}
                contentStyle={{ fontSize: 12, borderRadius: 12, border: "none", boxShadow: "var(--shadow-card)" }}
              />
              <Area
                type="monotone"
                dataKey="Stan konta (skumulowany)"
                stroke="var(--accent)"
                fillOpacity={1}
                fill="url(#colorCum)"
                strokeWidth={3}
              />
              <ReferenceLine y={0} stroke="oklch(0.5 0.01 0)" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Charts */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Threshold progression */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl mb-1">Postęp do II progu podatkowego</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Skumulowana roczna podstawa opodatkowania
          </p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => formatPLN(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={120000}
                  stroke="#c84026"
                  strokeDasharray="4 4"
                  label={{ value: "II próg 120k", fontSize: 10, fill: "#c84026" }}
                />
                {breakdowns.map(({ spouse }, idx) => (
                  <Bar
                    key={spouse.id}
                    dataKey={spouse.name}
                    stackId={undefined}
                    fill={COLORS[idx % COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl mb-1">Struktura wydatków</h2>
          <p className="text-sm text-muted-foreground mb-4">Suma: {formatPLN2(totalExpenses)}</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Brak wydatków — dodaj w zakładce Wydatki
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byCategory.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatPLN(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section className="grid sm:grid-cols-3 gap-4">
        <QuickCard
          to="/wynagrodzenia"
          title="Wynagrodzenia"
          desc={`${spouses.length} ${spouses.length === 1 ? "osoba" : "osoby"} · wspólne rozliczenie ${jointFiling ? "wł." : "wył."}`}
        />
        <QuickCard
          to="/wydatki"
          title="Wydatki"
          desc={`${expenses.length} pozycji · ${formatPLN(totalExpenses)}/m-c`}
        />
        <QuickCard
          to="/aktywa"
          title="Aktywa & długi"
          desc={`${investments.length + rentals.length + savings.length} aktywów · ${loans.length} kredytów`}
        />
      </section>
    </main>
  );
}

function QuickCard({
  to,
  title,
  desc,
}: {
  to: "/wynagrodzenia" | "/wydatki" | "/aktywa";
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)] hover:border-accent/50 transition-colors block"
    >
      <p className="font-display text-lg group-hover:text-accent transition-colors">{title} →</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </Link>
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
  return (full ? long : short)[m - 1];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Dzień dobry";
  if (h < 18) return "Cześć";
  return "Dobry wieczór";
}
