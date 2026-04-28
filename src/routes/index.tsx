import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { 
  X, 
  TrendingUp, 
  Wallet, 
  Landmark, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Plus,
  BarChart3,
  PieChart as PieIcon,
  CreditCard
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { StatCard } from "@/components/ui/stat-card";
import { useAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Przegląd — Saldeo" },
      {
        name: "description",
        content: "Saldeo — Twoje finanse, po ludzku. Przegląd dochodów, wydatków i majątku.",
      },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["#5b8c7a", "#e0a33c", "#c84026", "#4e8c8c", "#7a4e8c", "#8c7a4e", "#3a5e8c"];

function Dashboard() {
  const { session } = useAuthSession();
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

  // Month Navigation
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth() + 1);
  const navigateMonth = (dir: "prev" | "next") => {
    setSelectedMonthIdx(prev => {
      if (dir === "prev") return prev === 1 ? 12 : prev - 1;
      return prev === 12 ? 1 : prev + 1;
    });
  };

  const breakdowns = useMemo(
    () => spouses.map((s) => ({ spouse: s, r: calculateSalary(s.inputs, 0, globalSettings) })),
    [spouses, globalSettings],
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
      (l.monthlyOverpayment ?? 0),
    0,
  );
  const rentalNet = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);
  const rentalAssets = rentals.reduce((s, r) => s + r.marketValue, 0);
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0);

  const totalSelectedMonthNet = useMemo(() =>
    spouses.reduce((sum, s) => sum + calculateSalaryForMonth(s.inputs, selectedMonthIdx, globalSettings).net, 0),
    [spouses, selectedMonthIdx, globalSettings]
  );

  const getExpensesForMonth = (mIdx: number) => {
    return expenses.reduce((sum, e) => {
      if (isExpenseInMonth(e, mIdx)) return sum + e.amount;
      return sum;
    }, 0);
  };

  const selectedMonthExpenses = getExpensesForMonth(selectedMonthIdx);
  const selectedMonthCashflow = totalSelectedMonthNet + rentalNet - selectedMonthExpenses - monthlyLoanPmt;

  const totalAnnualAvgNet = useMemo(() =>
    spouses.reduce((sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings), 0),
    [spouses, globalSettings]
  );
  
  const annualAvgCashflow = totalAnnualAvgNet + rentalNet - totalExpenses - monthlyLoanPmt;
  const netWorth = totalInvestments + rentalAssets + totalSavings - totalLoans;

  const isCompletelyEmpty =
    spouses.length === 0 &&
    expenses.length === 0 &&
    investments.length === 0 &&
    loans.length === 0 &&
    rentals.length === 0 &&
    savings.length === 0;

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

  const [includeSavings, setIncludeSavings] = useState(true);
  const [includeInvestments, setIncludeInvestments] = useState(false);

  const cumulativeData = useMemo(() => {
    const annualBreakdowns = spouses.map((s) => calculateAnnualBreakdown(s.inputs, globalSettings));
    let cumulativeSurplus = 0;

    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const monthlyNet = annualBreakdowns.reduce((sum, b) => sum + b[idx].net, 0);
      const monthlyExpenses = getExpensesForMonth(month);
      const monthlyCashflow = monthlyNet + rentalNet - monthlyExpenses - monthlyLoanPmt;
      cumulativeSurplus += monthlyCashflow;

      return {
        month: monthLabel(month),
        "Suma nadwyżek": Math.round(cumulativeSurplus),
        "Gotówka": includeSavings ? totalSavings : 0,
        "Inwestycje": includeInvestments ? totalInvestments : 0,
      };
    });
  }, [spouses, expenses, rentalNet, monthlyLoanPmt, includeSavings, includeInvestments, totalSavings, totalInvestments]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-card border border-border p-8 sm:p-12 shadow-warm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-full bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-widest">
                Przegląd Saldeo
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {monthLabel(selectedMonthIdx, true)} 2025
              </div>
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">
              {greeting()}, <span className="italic text-accent">{session?.user.user_metadata?.nickname || "użytkowniku"}!</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
              Twoje saldo miesiąca wynosi <span className="text-foreground font-semibold underline decoration-accent/30 underline-offset-4">{formatPLN(selectedMonthCashflow)}</span>. 
              {selectedMonthCashflow >= 0 ? " To dobry czas na planowanie kolejnych inwestycji." : " Przyjrzyj się wydatkom w tym miesiącu."}
            </p>
          </div>

          <div className="bg-background/50 backdrop-blur-md border border-border/50 rounded-3xl p-8 shadow-xl flex flex-col items-center text-center min-w-[240px]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-4">Saldo Miesiąca</p>
            <div className={`font-display text-5xl font-bold tabular-nums mb-2 ${selectedMonthCashflow >= 0 ? "text-success" : "text-destructive"}`}>
              {formatPLN(selectedMonthCashflow)}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              {selectedMonthCashflow >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-success" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              )}
              {formatPLN(totalSelectedMonthNet)} wpływów
            </div>
          </div>
        </div>

        {/* Month Navigator Overlay */}
        <div className="absolute top-6 right-6 flex items-center bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-1 shadow-sm">
          <button 
            onClick={() => navigateMonth("prev")}
            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 text-xs font-bold uppercase tracking-wider text-foreground select-none min-w-[100px] text-center">
            {monthLabel(selectedMonthIdx, true)}
          </div>
          <button 
            onClick={() => navigateMonth("next")}
            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Primary Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Dochód Netto"
          value={formatPLN(totalSelectedMonthNet)}
          numberValue={totalSelectedMonthNet}
          tone="success"
          icon={Wallet}
          sub={`Wpływy w tym miesiącu`}
        />
        <StatCard
          label="Wydatki & Kredyty"
          value={formatPLN(selectedMonthExpenses + monthlyLoanPmt)}
          numberValue={selectedMonthExpenses + monthlyLoanPmt}
          tone="destructive"
          icon={CreditCard}
          sub={`Łącznie z kredytami`}
        />
        <StatCard
          label="Majątek Netto"
          value={formatPLN(netWorth)}
          numberValue={netWorth}
          tone="default"
          icon={Landmark}
          sub={`Wartość aktywów - długi`}
        />
        <StatCard
          label="Średnia Nadwyżka"
          value={formatPLN(annualAvgCashflow)}
          numberValue={annualAvgCashflow}
          tone={annualAvgCashflow >= 0 ? "success" : "destructive"}
          icon={Zap}
          sub={`Przeciętnie w 2025`}
          delta={{
            value: formatPLN(Math.abs(annualAvgCashflow - selectedMonthCashflow)),
            isPositive: selectedMonthCashflow > annualAvgCashflow
          }}
        />
      </section>

      {/* Main Content Area */}
      <section className="grid lg:grid-cols-3 gap-8">
        {/* Cumulative Growth Card */}
        <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border p-8 shadow-warm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="font-display text-2xl font-semibold mb-2">Projekcja Majątku</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Przewidywany wzrost oszczędności do końca 2025 roku.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-background/50 p-1.5 rounded-2xl border border-border">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${includeSavings ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`} onClick={() => setIncludeSavings(!includeSavings)}>
                <div className={`w-2 h-2 rounded-full ${includeSavings ? "bg-success" : "bg-muted"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Gotówka</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${includeInvestments ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`} onClick={() => setIncludeInvestments(!includeInvestments)}>
                <div className={`w-2 h-2 rounded-full ${includeInvestments ? "bg-blue-500" : "bg-muted"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Giełda</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="colorSurplus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b8c7a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#5b8c7a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="oklch(0.9 0.012 90)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border p-4 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{label}</p>
                          <div className="space-y-1.5">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center justify-between gap-8">
                                <span className="text-xs text-muted-foreground font-medium">{p.name}:</span>
                                <span className="text-xs font-bold text-foreground">{formatPLN(p.value as number)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Gotówka"
                  stackId="1"
                  stroke="#5b8c7a"
                  fillOpacity={1}
                  fill="url(#colorAssets)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Inwestycje"
                  stackId="1"
                  stroke="#3a5e8c"
                  fillOpacity={1}
                  fill="#3a5e8c"
                  fillOpacity={0.05}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Suma nadwyżek"
                  stackId="1"
                  stroke="var(--accent)"
                  fillOpacity={1}
                  fill="url(#colorSurplus)"
                  strokeWidth={3}
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories / Quick breakdown */}
        <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-warm flex flex-col">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold mb-2">Wydatki</h2>
            <p className="text-sm text-muted-foreground">Podział kategorii miesięcznie</p>
          </div>
          
          <div className="flex-1 min-h-[240px]">
            {byCategory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <PieIcon className="w-6 h-6" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Brak danych o wydatkach</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/wydatki">Dodaj wydatki</Link>
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="60%"
                    outerRadius="90%"
                    paddingAngle={4}
                    stroke="none"
                  >
                    {byCategory.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border border-border px-3 py-2 rounded-xl shadow-lg">
                            <span className="text-[10px] font-bold text-foreground">{payload[0].name}: {formatPLN(payload[0].value as number)}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-6 space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
            {byCategory.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{c.name}</span>
                </div>
                <span className="text-xs font-bold">{formatPLN(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tax progression Section */}
      <section className="bg-card rounded-[2.5rem] border border-border p-8 shadow-warm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="font-display text-2xl font-semibold mb-2">Progi Podatkowe</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kiedy przekroczysz 120 000 zł podstawy opodatkowania w 2025?
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <Zap className="w-4 h-4 fill-accent/20" />
            Aktualizowane na bieżąco
          </div>
        </div>

        <div className="h-64 mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projection} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="6 6" stroke="oklch(0.9 0.012 90)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: "oklch(0.56 0.14 175 / 0.05)" }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border p-3 rounded-xl shadow-xl">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-widest">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-6">
                            <span className="text-xs font-medium" style={{ color: p.fill }}>{p.name}:</span>
                            <span className="text-xs font-bold">{formatPLN(p.value as number)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={120000}
                stroke="#c84026"
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{ value: "120k", position: "insideTopRight", fill: "#c84026", fontSize: 10, fontWeight: "bold" }}
              />
              {spouses.map((spouse, idx) => (
                <Bar
                  key={spouse.id}
                  dataKey={spouse.name}
                  fill={COLORS[idx % COLORS.length]}
                  radius={[12, 12, 0, 0]}
                  maxBarSize={40}
                  animationDuration={1500}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border pt-8">
          {spouses.map((s, idx) => {
            const breakdown = calculateAnnualBreakdown(s.inputs, globalSettings);
            let cumulative = 0;
            let monthIndex = -1;
            for (let i = 0; i < 12; i++) {
              cumulative += breakdown[i].taxBase;
              if (cumulative > 120000) { monthIndex = i; break; }
            }
            
            return (
              <div key={s.id} className="flex flex-col p-4 rounded-3xl bg-background/50 border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <span className="font-semibold">{s.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Status progu:</span>
                  <span className={`text-xs font-bold ${monthIndex === -1 ? "text-muted-foreground" : "text-destructive"}`}>
                    {monthIndex === -1 ? "Bez zmian" : `${monthLabel(monthIndex + 1, true)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Floating Action Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-8 duration-500 pointer-events-none">
        <div className="bg-foreground text-background rounded-2xl p-2 shadow-2xl flex items-center justify-around gap-2 pointer-events-auto">
          <Link to="/wynagrodzenia" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-background/10 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Zarobki</span>
          </Link>
          <div className="w-px h-6 bg-background/10" />
          <Link to="/wydatki" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-background/10 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Wydatki</span>
          </Link>
          <div className="w-px h-6 bg-background/10" />
          <Link to="/aktywa" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-background/10 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Majątek</span>
          </Link>
        </div>
      </div>
    </div>
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

