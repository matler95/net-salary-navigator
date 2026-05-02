import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { actions, useAppState, type SavingsAccount, type Rental, type Loan } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatPLN, formatPLN2, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";
import { StatCard } from "@/components/ui/stat-card";
import {
  convertToPLN,
  formatCurrencyAmount,
  type InvestmentCurrency,
  useDailyFxRates,
} from "@/lib/fx";
import {
  getInvestmentCurrentValue,
  useDailyTickerPrices,
  searchTickers,
  type TickerSearchResult,
  getTickerCurrency,
} from "@/lib/market";
import {
  monthlyPayment,
  loanTotalInterest,
  rentalCashflow,
  amortizationSchedule,
  analyzeRental,
} from "@/lib/finance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Loader2,
  Search,
  Check,
  TrendingUp,
  Clock,
  Wallet,
  BarChart3,
  Pencil,
  Building2,
  Landmark,
  PieChart as PieChartIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/aktywa")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : "oszczednosci",
  }),
  head: () => ({
    meta: [
      { title: "Aktywa & długi - Saldeo" },
      {
        name: "description",
        content:
          "Inwestycje, kredyty i mieszkania na wynajem z wyliczeniem zysku i ryczałtem 8.5%/12.5%.",
      },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const investments = useAppState((s) => s.investments);
  const loans = useAppState((s) => s.loans);
  const rentals = useAppState((s) => s.rentals);
  const savings = useAppState((s) => s.savings);
  const { rates } = useDailyFxRates();
  const { prices: tickerPrices } = useDailyTickerPrices(investments.map((i) => i.ticker ?? ""));

  const totalInvestments = investments.reduce(
    (s, i) => s + convertToPLN(getInvestmentCurrentValue(i, tickerPrices), i.currency, rates),
    0,
  );
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0);
  const rentalAssets = rentals.reduce((s, r) => s + r.marketValue, 0);
  const totalAssets = totalInvestments + totalSavings + rentalAssets;
  const totalLoans = loans.reduce((s, l) => s + l.principal, 0);
  const netWorth = totalAssets - totalLoans;
  const rentalNet = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);

  const setTab = (t: string) => {
    void navigate({ search: (prev) => ({ ...prev, tab: t }) });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <Tabs value={tab} onValueChange={setTab} className="space-y-8">
        <header className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
              Majątek
            </p>
            <h1 className="font-display text-4xl sm:text-5xl">
              Co masz <span className="italic text-accent">i co jest Twoje</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Zarządzaj swoimi oszczędnościami, portfelem giełdowym, kredytami hipotecznymi i nieruchomościami na wynajem.
            </p>
          </div>

          <TabsList className="flex items-center justify-start h-auto p-1 bg-muted/40 border border-border rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            <TabsTrigger value="oszczednosci" className="rounded-xl px-5 py-2.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Oszczędności</TabsTrigger>
            <TabsTrigger value="inwestycje" className="rounded-xl px-5 py-2.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Inwestycje</TabsTrigger>
            <TabsTrigger value="kredyty" className="rounded-xl px-5 py-2.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Kredyty</TabsTrigger>
            <TabsTrigger value="wynajem" className="rounded-xl px-5 py-2.5 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Nieruchomości</TabsTrigger>
          </TabsList>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-up">
          <StatCard label="Aktywa razem" value={formatPLN(totalAssets)} tone="investment" animate />
          <StatCard label="Zobowiązania" value={formatPLN(totalLoans)} tone="debt" animate />
          <StatCard label="Majątek netto" value={formatPLN(netWorth)} tone={netWorth >= 0 ? "income" : "expense"} animate />
          <StatCard
            label={rentalNet >= 0 ? "Zysk z wynajmu" : "Strata z wynajmu"}
            value={formatPLN(rentalNet)}
            tone={rentalNet >= 0 ? "income" : "expense"}
            animate
          />
        </div>

        <TabsContent value="oszczednosci" className="mt-0 focus-visible:outline-none animate-fade-up">
          <SavingsSection />
        </TabsContent>
        <TabsContent value="inwestycje" className="mt-0 focus-visible:outline-none animate-fade-up">
          <InvestmentsSection />
        </TabsContent>
        <TabsContent value="kredyty" className="mt-0 focus-visible:outline-none animate-fade-up">
          <LoansSection />
        </TabsContent>
        <TabsContent value="wynajem" className="mt-0 focus-visible:outline-none animate-fade-up">
          <RentalsSection />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ─── PALETTE ─────────────────────────────────────────────────────────── */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.55 0.14 190)",
  "oklch(0.65 0.18 350)",
  "oklch(0.5 0.1 220)",
];

/* ─── LOAN PAYMENT UTILITIES ────────────────────────────────────────── */
function getPaymentDueInfo(loan: { paymentDayOfMonth?: number; lastPaymentDate?: string }) {
  if (!loan.paymentDayOfMonth)
    return { isDue: false, daysUntil: null, isOverdue: false, nextDate: null };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Calculate this month's payment date
  const thisMonthPaymentDate = new Date(currentYear, currentMonth, loan.paymentDayOfMonth);

  // If this month's payment date is in the past, next payment is next month
  const nextPaymentDate =
    thisMonthPaymentDate < today
      ? new Date(currentYear, currentMonth + 1, loan.paymentDayOfMonth)
      : thisMonthPaymentDate;

  const lastPayment = loan.lastPaymentDate ? new Date(loan.lastPaymentDate) : null;

  // Check if payment is due (next payment date has passed)
  const isPassed = nextPaymentDate < today;

  // Check if already paid this month
  const paymentAlreadyMadeThisMonth =
    lastPayment &&
    lastPayment.getFullYear() === currentYear &&
    lastPayment.getMonth() === currentMonth;

  return {
    needsPayment: isPassed && !paymentAlreadyMadeThisMonth,
    isOverdue: isPassed && !paymentAlreadyMadeThisMonth,
    daysUntil: Math.ceil((nextPaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    nextDate: nextPaymentDate.toISOString().slice(0, 10),
  };
}

function calculateLoanAfterPayment(
  principal: number,
  annualRatePct: number,
  monthsRemaining: number,
  monthlyOverpayment: number = 0,
): { principal: number; monthsRemaining: number } {
  const pmt = monthlyPayment(principal, annualRatePct, monthsRemaining);
  const interest = (principal * annualRatePct) / 100 / 12;
  const principalPayment = pmt - interest;
  const overpay = monthlyOverpayment;
  const totalPayment = principalPayment + overpay;

  const newPrincipal = Math.max(0, principal - totalPayment);
  const newMonths = newPrincipal > 0 ? Math.max(0, monthsRemaining - 1) : 0;

  return { principal: newPrincipal, monthsRemaining: newMonths };
}

/* INVESTMENTS */
function InvestmentsSection() {
  const investments = useAppState((s) => s.investments);
  const { rates, loading: fxLoading } = useDailyFxRates();
  const { prices: tickerPrices, loading: tickerLoading } = useDailyTickerPrices(
    investments.map((i) => i.ticker ?? ""),
  );
  const [view, setView] = useState<"list" | "summary">("list");

  const effectiveCurrency = (i: (typeof investments)[number]) => {
    const ticker = (i.ticker ?? "").trim().toLowerCase();
    const yahooCur = getTickerCurrency(ticker, tickerPrices) as InvestmentCurrency | undefined;
    return yahooCur && ["PLN", "EUR", "USD", "GBP"].includes(yahooCur) ? yahooCur : i.currency;
  };

  const investmentValues = investments.map((i) => {
    const cur = effectiveCurrency(i);
    const valuePLN = convertToPLN(getInvestmentCurrentValue(i, tickerPrices), cur, rates);
    const profitPLN = i.totalCostPLN > 0 ? valuePLN - i.totalCostPLN : 0;
    const profitPct = i.totalCostPLN > 0 ? (profitPLN / i.totalCostPLN) * 100 : 0;
    return { ...i, valuePLN, profitPLN, profitPct, cur };
  });

  const total = investmentValues.reduce((s, i) => s + i.valuePLN, 0);
  const totalProfit = investmentValues.reduce((s, i) => s + i.profitPLN, 0);
  const totalCost = investmentValues.reduce((s, i) => s + i.totalCostPLN, 0);
  const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {investments.length > 0 && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setView("list")}
                className={`px-2.5 py-1 transition-colors ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Lista
              </button>
              <button
                onClick={() => setView("summary")}
                className={`px-2.5 py-1 transition-colors ${view === "summary" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Podsumowanie
              </button>
            </div>
          )}
          <div className="text-right flex flex-wrap items-center gap-x-3">
            <p className="text-sm text-muted-foreground">
              Łącznie {formatPLN(total)}
              {totalCost > 0 && (
                <span className={totalProfit >= 0 ? "text-income" : "text-expense"}>
                  {" "}({totalProfit >= 0 ? "+" : ""}{formatPLN(totalProfit)} · {totalProfitPct.toFixed(1)}%)
                </span>
              )}
              {fxLoading || tickerLoading ? " · aktualizacja..." : ""}
            </p>
            <div className="flex gap-1 justify-end">
              {!!rates.asOf && (
                <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  FX: {rates.asOf}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AddInvestmentDialog />
        </div>
      </div>

      {investments.length === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title="Brak inwestycji"
          description="Dodaj swoje akcje, ETFy lub krypto, aby śledzić wartość portfela i jego strukturę w czasie rzeczywistym."
          className="my-8"
        />
      ) : (
        <>
          {/* ── IMPROVED SUMMARY VIEW ── */}
          {view === "summary" && investments.length > 0 && (
            <InvestmentsSummaryView
              investmentValues={investmentValues}
              total={total}
              effectiveCurrency={effectiveCurrency}
              tickerPrices={tickerPrices}
            />
          )}

          {view === "list" && investments.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden animate-fade-up">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Nazwa</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Typ</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Ticker</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Waluta</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Wolumen</th>
                    <th className="text-right px-4 py-3 font-medium">Wartość</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Zysk / Strata</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">%</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {investmentValues.map((i) => {
                    const portfolioPct = total > 0 ? (i.valuePLN / total) * 100 : 0;
                    return (
                      <tr key={i.id} className="border-t border-border group hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2">
                          <Input
                            value={i.label}
                            onChange={(e) => actions.updateInvestment(i.id, { label: e.target.value })}
                            className="h-10 bg-transparent border-0 px-1 hover:bg-muted/50 focus-visible:ring-1 shadow-none font-medium"
                          />
                        </td>
                        <td className="px-4 py-2 hidden md:table-cell text-muted-foreground text-xs">{i.type}</td>
                        <td className="px-4 py-2 hidden lg:table-cell">
                          <Input
                            value={i.ticker ?? ""}
                            onChange={(e) =>
                              actions.updateInvestment(i.id, {
                                ticker: e.target.value.trim().toLowerCase(),
                              })
                            }
                            placeholder="np. vwce.de"
                            className="h-10 w-[122px] font-mono text-xs bg-transparent border-0 px-1 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                          />
                        </td>
                        <td className="px-4 py-2 hidden lg:table-cell">
                          <Select
                            value={i.currency}
                            onValueChange={(v) =>
                              actions.updateInvestment(i.id, { currency: v as InvestmentCurrency })
                            }
                          >
                            <SelectTrigger className="h-10 w-[88px] bg-transparent border-0 hover:bg-muted/50 shadow-none text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["PLN", "EUR", "USD", "GBP"] as InvestmentCurrency[]).map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2 hidden sm:table-cell">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={formatLocaleAmount(i.volume ?? 0, 4)}
                            onChange={(e) =>
                              actions.updateInvestment(i.id, {
                                volume: parseLocaleAmount(e.target.value),
                              })
                            }
                            className="h-10 text-right font-mono tabular-nums bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <p className="text-sm font-mono font-semibold tabular-nums">
                            {i.valuePLN > 0 ? formatPLN(i.valuePLN) : "-"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {formatCurrencyAmount(getInvestmentCurrentValue(i, tickerPrices), i.cur)}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-right hidden sm:table-cell">
                          {i.totalCostPLN > 0 ? (
                            <div className={i.profitPLN >= 0 ? "text-income" : "text-expense"}>
                              <p className="text-xs font-mono font-semibold tabular-nums">
                                {i.profitPLN >= 0 ? "+" : ""}{formatPLN2(i.profitPLN)}
                              </p>
                              <p className="text-[10px] font-bold">
                                {i.profitPct.toFixed(1)}%
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums hidden md:table-cell text-xs">
                          {portfolioPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 w-28">
                          <div className="flex items-center justify-end gap-1">
                            <BuyMoreDialog
                              investment={i}
                              currentPrice={i.ticker ? tickerPrices.byTicker[i.ticker] : undefined}
                            />
                            <button
                              onClick={() => {
                                const copy = { ...i };
                                actions.removeInvestment(i.id);
                                toast(`Usunięto inwestycję: ${i.label || i.ticker}`, {
                                  action: {
                                    label: "Cofnij",
                                    onClick: () => {
                                      const { id, ...rest } = copy;
                                      actions.addInvestment(rest as any);
                                    },
                                  },
                                  duration: 5000,
                                });
                              }}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-2 rounded-lg"
                              aria-label={`Usuń ${i.label || i.ticker}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Kursy walut: NBP (PLN/EUR/USD/GBP), odświeżane raz dziennie. Ticker: kurs bieżący via Yahoo
        Finance, cache dobowy.
      </p>
    </section>
  );
}

/* ── INVESTMENTS SUMMARY VIEW (redesigned) ──────────────────────────── */
function InvestmentsSummaryView({
  investmentValues,
  total,
  effectiveCurrency,
  tickerPrices,
}: {
  investmentValues: Array<{
    id: string;
    label: string;
    type: string;
    ticker?: string;
    volume?: number;
    tickerPriceAtAdd?: number;
    tickerPriceDate?: string;
    currency: InvestmentCurrency;
    monthlyContribution: number;
    valuePLN: number;
    profitPLN: number;
    profitPct: number;
    totalCostPLN: number;
  }>;
  total: number;
  effectiveCurrency: (i: any) => InvestmentCurrency;
  tickerPrices: any;
}) {
  const sorted = [...investmentValues].sort((a, b) => b.valuePLN - a.valuePLN);
  const monthlyContribTotal = investmentValues.reduce(
    (s, i) => s + (i.monthlyContribution ?? 0),
    0,
  );
  const unvalued = investmentValues.filter((i) => i.valuePLN === 0).length;

  const totalProfit = investmentValues.reduce((s, i) => s + i.profitPLN, 0);
  const totalCost = investmentValues.reduce((s, i) => s + i.totalCostPLN, 0);
  const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Donut chart data - top 6 + "Inne"
  const donutData = useMemo(() => {
    const top6 = sorted.filter((i) => i.valuePLN > 0).slice(0, 6);
    const rest = sorted.filter((i) => i.valuePLN > 0).slice(6);
    const restTotal = rest.reduce((s, i) => s + i.valuePLN, 0);
    const result = top6.map((i) => ({ name: i.label, value: i.valuePLN }));
    if (restTotal > 0) result.push({ name: "Inne", value: restTotal });
    return result;
  }, [sorted]);

  // Type breakdown
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    investmentValues.forEach((i) => {
      map.set(i.type, (map.get(i.type) || 0) + i.valuePLN);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ type, value, pct: total > 0 ? (value / total) * 100 : 0 }));
  }, [investmentValues, total]);

  // Currency exposure
  const byCurrency = useMemo(() => {
    const map = new Map<string, number>();
    investmentValues.forEach((i) => {
      const cur = effectiveCurrency(i);
      map.set(cur, (map.get(cur) || 0) + i.valuePLN);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([currency, value]) => ({
        currency,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
      }));
  }, [investmentValues, total, effectiveCurrency]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const { name, value } = payload[0];
      return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card text-xs">
          <p className="font-medium mb-0.5">{name}</p>
          <p className="font-mono text-accent">{formatPLN(value)}</p>
          <p className="text-muted-foreground">
            {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Wartość portfela
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">{formatPLN(total)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Wpłaty / m-c
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">
            {monthlyContribTotal > 0 ? formatPLN(monthlyContribTotal) : "-"}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Zysk / Strata (P&L)
          </p>
          <p className={`text-2xl font-bold tabular-nums font-display ${totalProfit >= 0 ? "text-income" : "text-expense"}`}>
            {totalProfit >= 0 ? "+" : ""}{formatPLN(totalProfit)}
          </p>
          {totalCost > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Średni zwrot: {totalProfitPct.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Największa pozycja
          </p>
          {sorted[0] ? (
            <>
              <p className="text-sm font-semibold truncate">{sorted[0].label}</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {formatPLN(sorted[0].valuePLN)} ·{" "}
                {total > 0 ? ((sorted[0].valuePLN / total) * 100).toFixed(1) : 0}%
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">-</p>
          )}
        </div>
      </div>

      {/* Donut chart + breakdowns */}
      <div className="grid lg:grid-cols-[1fr,1fr] gap-4">
        {/* Donut allocation chart */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <p className="text-sm font-semibold mb-4">Alokacja portfela</p>
          {total > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {donutData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="text-xs truncate flex-1">{d.name}</span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                      {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Brak wycen</p>
          )}
        </div>

        {/* Type + currency breakdown */}
        <div className="space-y-4">
          {/* By type */}
          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <p className="text-sm font-semibold mb-3">Klasy aktywów</p>
            <div className="space-y-2.5">
              {byType.map(({ type, value, pct }, idx) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{type}</span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {formatPLN(value)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By currency */}
          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <p className="text-sm font-semibold mb-3">Ekspozycja walutowa</p>
            <div className="space-y-2.5">
              {byCurrency.map(({ currency, value, pct }, idx) => (
                <div key={currency}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium font-mono">{currency}</span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {formatPLN(value)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: CHART_COLORS[(idx + 2) % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-position table */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Pozycje ({sorted.length})
          </p>
        </div>
        <div className="divide-y divide-border">
          {sorted.map((i, idx) => {
            const pct = total > 0 ? (i.valuePLN / total) * 100 : 0;
            return (
              <div
                key={i.id}
                className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/20 transition-colors"
              >
                {/* Rank */}
                <span className="text-[11px] font-mono text-muted-foreground w-4 shrink-0">
                  {idx + 1}
                </span>
                {/* Color dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.label}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {i.ticker?.toUpperCase() || "-"}
                    {i.volume ? ` · ${i.volume.toLocaleString("pl-PL")} szt.` : ""}
                    {" · "}
                    {effectiveCurrency(i)}
                  </p>
                </div>
                {/* Allocation bar */}
                <div className="w-24 hidden sm:block">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
                {/* Value & P&L */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-semibold tabular-nums">
                    {i.valuePLN > 0 ? (
                      formatPLN(i.valuePLN)
                    ) : (
                      <span className="text-muted-foreground text-xs">bez wyceny</span>
                    )}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {i.totalCostPLN > 0 && (
                      <span className={`text-[10px] font-medium ${i.profitPLN >= 0 ? "text-income" : "text-expense"}`}>
                        {i.profitPLN >= 0 ? "+" : ""}{formatPLN2(i.profitPLN)} ({i.profitPct.toFixed(1)}%)
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                  <BuyMoreDialog
                    investment={i}
                    currentPrice={i.ticker ? tickerPrices.byTicker[i.ticker] : undefined}
                  />
                  <button
                    onClick={() => {
                      const copy = { ...i };
                      actions.removeInvestment(i.id);
                      toast(`Usunięto inwestycję: ${i.label || i.ticker}`, {
                        action: {
                          label: "Cofnij",
                          onClick: () => {
                            const { id, ...rest } = copy;
                            actions.addInvestment(rest as any);
                          },
                        },
                        duration: 5000,
                      });
                    }}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-2 rounded-lg"
                    aria-label={`Usuń ${i.label || i.ticker}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Brak pozycji</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AddInvestmentDialog() {
  const { rates } = useDailyFxRates();
  const [open, setOpen] = useState(false);
  const EMPTY = { ticker: "", name: "", currency: "EUR" as InvestmentCurrency };
  const [draft, setDraft] = useState(EMPTY);
  const [volumeInput, setVolumeInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuery = useCallback((value: string) => {
    setQuery(value);
    setDropOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchTickers(value);
      setResults(found);
      setSearching(false);
    }, 350);
  }, []);

  const handleSelect = (result: TickerSearchResult) => {
    const cur = (result.currency === "GBp" ? "GBP" : result.currency) as InvestmentCurrency;
    const supportedCur = (["PLN", "EUR", "USD"] as InvestmentCurrency[]).includes(cur)
      ? cur
      : "EUR";
    setDraft({ ...draft, ticker: result.symbol, name: result.name, currency: supportedCur });
    setQuery(result.symbol);
    setDropOpen(false);
    setResults([]);
  };

  const handleReset = () => {
    setDraft(EMPTY);
    setVolumeInput("");
    setPriceInput("");
    setQuery("");
    setResults([]);
    setDropOpen(false);
    setSearching(false);
  };

  const selectedTicker = draft.ticker.trim().toLowerCase();
  const { prices: tickerPrices, loading: tickerPricesLoading } = useDailyTickerPrices(
    selectedTicker ? [selectedTicker] : [],
  );
  const currentTickerPrice = selectedTicker ? tickerPrices.byTicker[selectedTicker] ?? 0 : 0;
  const currentTickerCurrency = selectedTicker
    ? (getTickerCurrency(selectedTicker, tickerPrices) ?? draft.currency) as InvestmentCurrency
    : draft.currency;
  const enteredPrice = parseLocaleAmount(priceInput);
  const effectivePrice = enteredPrice > 0 ? enteredPrice : currentTickerPrice;
  const volume = parseLocaleAmount(volumeInput);
  const positionValue =
    volume > 0 && effectivePrice > 0
      ? convertToPLN(volume * effectivePrice, currentTickerCurrency, rates)
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full px-5 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Dodaj inwestycję
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Dodaj inwestycję</DialogTitle>
          <DialogDescription>
            Wyszukaj ETF, akcję lub krypto. Wycena pobierana automatycznie.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const ticker = draft.ticker.trim();
            if (!ticker || volume <= 0 || effectivePrice <= 0) return;

            // Use the effective price (manual or fetched)
            const totalCostPLN = convertToPLN(volume * effectivePrice, currentTickerCurrency, rates);

            actions.addInvestment({
              label: draft.name || ticker,
              type: "ETF",
              ticker: ticker.toLowerCase(),
              currency: draft.currency,
              volume,
              value: 0,
              tickerPriceAtAdd: effectivePrice,
              tickerPriceDate: new Date().toISOString().slice(0, 10),
              monthlyContribution: 0,
              totalCostPLN,
            });
            handleReset();
            setOpen(false);
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Instrument</label>
            <Popover
              open={dropOpen && (results.length > 0 || searching)}
              onOpenChange={setDropOpen}
            >
              <PopoverAnchor asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQuery(e.target.value)}
                    onFocus={() => {
                      if (results.length > 0) setDropOpen(true);
                    }}
                    placeholder="Szukaj: iShares, VWCE, AAPL, Bitcoin..."
                    className="pl-9 font-mono"
                    autoFocus
                    autoComplete="off"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </PopoverAnchor>
              <PopoverContent
                className="p-0 w-[380px]"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <ul className="max-h-64 overflow-y-auto divide-y divide-border">
                  {results.map((r) => (
                    <li key={r.symbol}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start justify-between gap-3"
                        onClick={() => handleSelect(r)}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold truncate">{r.symbol}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                            {r.type}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.exchange} · {r.currency}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            {draft.name && (
              <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                <Check className="w-3 h-3" /> {draft.name} ({draft.ticker})
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-left text-sm font-medium">Waluta</label>
            <Select
              value={draft.currency}
              onValueChange={(v: any) => setDraft({ ...draft, currency: v })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["PLN", "EUR", "USD"] as InvestmentCurrency[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-left text-sm font-medium">Wolumen</label>
            <Input
              type="text"
              inputMode="decimal"
              value={volumeInput}
              onChange={(e) => setVolumeInput(e.target.value)}
              placeholder="np. 10"
              className="font-mono tabular-nums h-10"
            />
          </div>

          {/* <div className="grid gap-2">
            <label className="text-left text-sm font-medium">Cena zakupu</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder={currentTickerPrice > 0 ? "pozostaw puste, aby użyć ceny bieżącej" : "np. 100.50"}
                className="font-mono tabular-nums h-10 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{draft.currency}</span>
            </div>
          </div> */}

          <div className="grid gap-2">
            <label className="text-left text-sm font-medium">Wartość pozycji</label>
            <div className="relative">
              <Input
                type="text"
                disabled
                value={positionValue > 0 ? formatPLN(positionValue) : "0 zł"}
                className="font-mono tabular-nums h-10 bg-muted"
              />
            </div>
          </div>
          <div className="px-4 text-sm text-muted-foreground h-5">
            {currentTickerPrice > 0 && !priceInput.trim()
              ? `Aktualna cena/szt: ${formatLocaleAmount(currentTickerPrice, 4)} ${currentTickerCurrency}`
              : enteredPrice > 0
              ? `Wprowadzona cena: ${formatLocaleAmount(enteredPrice, 4)} ${draft.currency}`
              : ""}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!draft.ticker.trim() || volume <= 0 || effectivePrice <= 0}
            >
              Dodaj do portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BuyMoreDialog({ investment, currentPrice }: { investment: any; currentPrice?: number }) {
  const { rates } = useDailyFxRates();
  const [open, setOpen] = useState(false);
  const [addedVolume, setAddedVolume] = useState("");
  const [buyPrice, setBuyPrice] = useState(currentPrice ? String(currentPrice) : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-accent p-1.5" title="Dokup więcej">
          <PlusCircle className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Dokup: {investment.label}</DialogTitle>
          <DialogDescription>
            Dodaj wolumen do istniejącej pozycji i przelicz średnią cenę.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            const additionalVol = parseLocaleAmount(addedVolume);
            const newPrice = parseLocaleAmount(buyPrice);
            if (additionalVol <= 0) return;
            const currentVol = investment.volume || 0;
            const currentAvg = investment.tickerPriceAtAdd || 0;
            const newTotalVol = currentVol + additionalVol;
            const newAvgPrice = (currentVol * currentAvg + additionalVol * newPrice) / newTotalVol;

            // Record cost in PLN
            const purchaseCostPLN = convertToPLN(additionalVol * newPrice, investment.currency, rates);
            const newTotalCostPLN = (investment.totalCostPLN || 0) + purchaseCostPLN;

            actions.updateInvestment(investment.id, {
              volume: newTotalVol,
              tickerPriceAtAdd: newAvgPrice,
              tickerPriceDate: new Date().toISOString().slice(0, 10),
              totalCostPLN: newTotalCostPLN,
            });
            setOpen(false);
            setAddedVolume("");
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm">Sztuki</label>
            <Input
              type="text"
              inputMode="decimal"
              value={addedVolume}
              onChange={(e) => setAddedVolume(e.target.value)}
              onBlur={() => setAddedVolume(formatLocaleAmount(parseLocaleAmount(addedVolume), 4))}
              className="col-span-3 font-mono h-10"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm">Cena / szt.</label>
            <Input
              type="text"
              inputMode="decimal"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              onBlur={() => setBuyPrice(formatLocaleAmount(parseLocaleAmount(buyPrice), 4))}
              className="col-span-3 font-mono h-10"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Zapisz transakcję</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* LOANS */
function LoansSection() {
  const loans = useAppState((s) => s.loans);
  const totalDebt = loans.reduce((s, l) => s + l.principal, 0);
  const totalPmt = loans.reduce(
    (s, l) =>
      s +
      monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining) +
      (l.monthlyOverpayment ?? 0) +
      (l.mortgageInsuranceMonthly ?? 0),
    0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Łącznie {formatPLN(totalDebt)} · raty {formatPLN(totalPmt)}/m-c (z nadpłatą)
        </p>
        <div className="flex items-center gap-3">
          <AddLoanDialog />
        </div>
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Brak kredytów"
          description="Dodaj swoje kredyty hipoteczne lub gotówkowe, aby śledzić saldo zadłużenia i automatycznie planować spłaty."
          className="my-8"
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 animate-fade-up">
          {loans.map((l) => (
            <LoanCard key={l.id} loan={l} />
          ))}
        </div>
      )}
    </section>
  );
}

function LoanCard({
  loan,
}: {
  loan: {
    id: string;
    label: string;
    principal: number;
    annualRatePct: number;
    monthsRemaining: number;
    monthlyOverpayment?: number;
    paymentDayOfMonth?: number;
    lastPaymentDate?: string;
    mortgageInsuranceMonthly: number;
    overpaymentType?: "fixed" | "dynamic";
  };
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const overpay = loan.monthlyOverpayment ?? 0;
  const paymentInfo = getPaymentDueInfo(loan);
  const pmt = monthlyPayment(loan.principal, loan.annualRatePct, loan.monthsRemaining);
  const insurance = loan.mortgageInsuranceMonthly ?? 0;

  const scheduleNoOverpay = useMemo(
    () => amortizationSchedule(loan.principal, loan.annualRatePct, loan.monthsRemaining, 0),
    [loan.principal, loan.annualRatePct, loan.monthsRemaining],
  );
  const schedule = useMemo(
    () =>
      amortizationSchedule(
        loan.principal,
        loan.annualRatePct,
        loan.monthsRemaining,
        overpay,
        loan.overpaymentType || "fixed",
        insurance,
      ),
    [loan.principal, loan.annualRatePct, loan.monthsRemaining, overpay, loan.overpaymentType, insurance],
  );

  const totalMonthlyCost = pmt + overpay + insurance;
  const interestNoOverpay = loanTotalInterest(
    loan.principal,
    loan.annualRatePct,
    loan.monthsRemaining,
  );
  const interestWithOverpay = schedule.reduce((s, r) => s + r.interest, 0);
  const interestSaved = interestNoOverpay - interestWithOverpay;
  const monthsSaved = scheduleNoOverpay.length - schedule.length;

  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(schedule.length / 60));
    return schedule
      .filter((_, i) => i % step === 0 || i === schedule.length - 1)
      .map((r) => ({ month: r.month, balance: r.balance }));
  }, [schedule]);


  return (
    <div className="bg-card rounded-2xl p-8 border border-border shadow-card group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <Input
            value={loan.label}
            onChange={(e) => actions.updateLoan(loan.id, { label: e.target.value })}
            className="font-display text-2xl h-10 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none truncate hover:bg-muted/30 rounded-lg px-2 -ml-2"
          />
          <p className="text-xs text-muted-foreground mt-1 px-0.5">
            {paymentInfo.needsPayment ? `Termin: ${paymentInfo.nextDate}` : `Następna rata: ${paymentInfo.nextDate}`} · {loan.annualRatePct}% · {loan.monthsRemaining} m-cy · <span className="font-bold text-foreground">{formatPLN2(totalMonthlyCost)}/m-c · </span>
          </p>
        </div>
        <button
          onClick={() => {
            const copy = { ...loan };
            actions.removeLoan(loan.id);
            toast(`Usunięto kredyt: ${loan.label}`, {
              action: {
                label: "Cofnij",
                onClick: () => {
                  const { id, ...rest } = copy;
                  actions.addLoan(rest as any);
                },
              },
              duration: 5000,
            });
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-2 rounded-lg"
          aria-label={`Usuń kredyt: ${loan.label}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-4 px-0.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent flex items-center gap-1.5 transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {isExpanded ? "Ukryj parametry" : "Edytuj parametry"}
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <Field label="Kapitał">
            <LocalNumInput
              value={loan.principal}
              onChange={(v) => actions.updateLoan(loan.id, { principal: v })}
              className="h-10 font-mono tabular-nums"
              decimals={0}
            />
          </Field>
          <Field label="Oproc. %">
            <LocalNumInput
              value={loan.annualRatePct}
              onChange={(v) => actions.updateLoan(loan.id, { annualRatePct: v })}
              className="h-10 font-mono tabular-nums"
              decimals={2}
            />
          </Field>
          <Field label="Pozostałe m-ce">
            <Input
              type="number"
              value={loan.monthsRemaining}
              onChange={(e) =>
                actions.updateLoan(loan.id, { monthsRemaining: parseInt(e.target.value) || 0 })
              }
              className="h-10 font-mono tabular-nums"
            />
          </Field>
          <Field label={loan.overpaymentType === "dynamic" ? "Suma miesięczna" : "Nadpłata / m-c"}>
            <div className="flex flex-col gap-1.5">
              <LocalNumInput
                value={loan.overpaymentType === "dynamic" ? totalMonthlyCost : overpay}
                onChange={(v) => {
                  if (loan.overpaymentType === "dynamic") {
                    actions.updateLoan(loan.id, { monthlyOverpayment: Math.max(0, v - pmt - insurance) });
                  } else {
                    actions.updateLoan(loan.id, { monthlyOverpayment: v });
                  }
                }}
                className="h-10 font-mono tabular-nums text-accent"
                decimals={0}
              />
              <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg border border-border/50">
                <button
                  onClick={() => actions.updateLoan(loan.id, { overpaymentType: "fixed" })}
                  className={cn(
                    "flex-1 py-1 text-[9px] uppercase font-bold rounded-md transition-all",
                    loan.overpaymentType !== "dynamic"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Stała
                </button>
                <button
                  onClick={() => actions.updateLoan(loan.id, { overpaymentType: "dynamic" })}
                  className={cn(
                    "flex-1 py-1 text-[9px] uppercase font-bold rounded-md transition-all",
                    loan.overpaymentType === "dynamic"
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  Dyna.
                </button>
              </div>
            </div>
          </Field>
          <Field label="Ubezpieczenie">
            <LocalNumInput
              value={loan.mortgageInsuranceMonthly}
              onChange={(v) => actions.updateLoan(loan.id, { mortgageInsuranceMonthly: v })}
              className="h-10 font-mono tabular-nums"
              decimals={0}
            />
          </Field>
          <Field label="Dzień płatności">
            <Select
              value={loan.paymentDayOfMonth?.toString() ?? ""}
              onValueChange={(v) =>
                actions.updateLoan(loan.id, { paymentDayOfMonth: v ? parseInt(v) : undefined })
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Ustaw dzień" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Dzień {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <div className="bg-accent/5 rounded-xl p-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-center mb-3 border border-accent/20">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Rata + Ub.</p>
          <p className="font-mono tabular-nums text-sm font-bold text-accent">{formatPLN2(pmt + insurance)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            {loan.overpaymentType === "dynamic" ? "Suma (stała)" : "Z nadpłatą"}
          </p>
          <p className="font-mono tabular-nums text-sm font-bold text-accent">
            {formatPLN2(totalMonthlyCost)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Odsetki</p>
          <p className="font-mono tabular-nums text-sm font-semibold text-destructive">
            {formatPLN(interestWithOverpay)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spłata za</p>
          <p className="font-mono tabular-nums text-sm font-semibold">
            {(schedule.length / 12).toFixed(1)} lat
          </p>
        </div>
      </div>

      {overpay > 0 && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 grid grid-cols-2 gap-2 text-center mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Zaoszczędzone odsetki</p>
            <p className="font-mono tabular-nums text-sm font-semibold text-success">
              {formatPLN(interestSaved)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spłata szybciej o</p>
            <p className="font-mono tabular-nums text-sm font-semibold text-success">
              {monthsSaved} m-cy
            </p>
          </div>
        </div>
      )}

      <div className="h-32 -mx-2">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`bal-${loan.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.55 0.12 30)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="oklch(0.55 0.12 30)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${(v / 12).toFixed(0)}r`}
            />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number) => formatPLN(v)}
              labelFormatter={(m) => `Miesiąc ${m}`}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="oklch(0.55 0.12 30)"
              strokeWidth={2}
              fill={`url(#bal-${loan.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        onClick={() => setShowSchedule((s) => !s)}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${showSchedule ? "rotate-180" : ""}`}
        />
        {showSchedule ? "Ukryj" : "Pokaż"} harmonogram
      </button>

      {showSchedule && (
        <div className="mt-2 max-h-64 overflow-y-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground bg-muted/40 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 font-medium">M-c</th>
                <th className="text-right px-2 py-1 font-medium">Rata</th>
                <th className="text-right px-2 py-1 font-medium">Odsetki</th>
                <th className="text-right px-2 py-1 font-medium">Kapitał</th>
                <th className="text-right px-2 py-1 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {schedule.map((r) => (
                <tr key={r.month} className="border-t border-border">
                  <td className="px-2 py-0.5">{r.month}</td>
                  <td className="px-2 py-0.5 text-right">{formatPLN2(r.payment)}</td>
                  <td className="px-2 py-0.5 text-right text-destructive">
                    {formatPLN2(r.interest)}
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    {formatPLN2(r.principal + r.overpayment)}
                  </td>
                  <td className="px-2 py-0.5 text-right">{formatPLN2(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* RENTALS */
function RentalsSection() {
  const rentals = useAppState((s) => s.rentals);
  const loans = useAppState((s) => s.loans);
  const rentalAnalyses = useMemo(
    () => rentals.map((r) => analyzeRental(r, loans)),
    [rentals, loans],
  );

  const totalCashflow = rentalAnalyses.reduce((s, a) => s + a.monthlyCashflow, 0);
  const totalValue = rentals.reduce((s, r) => s + r.marketValue, 0);
  const totalEquity = rentalAnalyses.reduce((s, a) => s + a.equity, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col gap-1 text-muted-foreground text-sm">
          <span>Łączna wartość: {formatPLN(totalValue)}</span>
          <span>
            {totalCashflow >= 0 ? "Zysk" : "Strata"} {formatPLN(totalCashflow)}/m-c · equity {formatPLN(totalEquity)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AddRentalDialog />
        </div>
      </div>

      {rentals.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Brak nieruchomości"
          description="Zarządzasz mieszkaniami na wynajem? Dodaj je tutaj, aby śledzić rentowność, koszty i miesięczny zysk na czysto."
          className="my-8"
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 animate-fade-up">
          {rentals.map((r) => (
            <RentalCard key={r.id} rental={r} loans={loans} />
          ))}
        </div>
      )}
    </section>
  );
}

function RentalCard({ rental, loans }: { rental: Rental; loans: Loan[] }) {
  const analysis = useMemo(() => analyzeRental(rental, loans), [rental, loans]);
  const [expanded, setExpanded] = useState(false);
  const linkedLoan = rental.linkedLoanId ? loans.find((l) => l.id === rental.linkedLoanId) : null;

  // Determine mortgage source for display
  const getMortgageDisplay = () => {
    if (linkedLoan) {
      return `Powiązany kredyt: ${linkedLoan.label}`;
    } else if (rental.mortgageMonthly && rental.mortgageMonthly > 0) {
      return `Rata kredytu: ${formatPLN(rental.mortgageMonthly)}${rental.mortgageInsuranceMonthly ? ` + ubezp. ${formatPLN(rental.mortgageInsuranceMonthly)}` : ''}`;
    } else if (rental.monthlyMortgage && rental.monthlyMortgage > 0) {
      return `Rata kredytu: ${formatPLN(rental.monthlyMortgage)}`;
    } else {
      return "Brak kredytu";
    }
  };

  const chartData = useMemo(() => {
    // Use actual remaining loan balance from analysis
    const startLoan = Math.max(0, rental.marketValue - analysis.equity);
    const loanYears = linkedLoan
      ? Math.max(1, linkedLoan.monthsRemaining / 12)
      : rental.mortgageRemaining
        ? Math.max(1, rental.mortgageRemaining / 12)
        : 25; // Default 25 years for manual mortgages

    return Array.from({ length: 11 }, (_, index) => {
      const year = index;
      const value = rental.marketValue * Math.pow(1 + ((rental.appreciationPct ?? 4) / 100), year);
      const balance = startLoan > 0 ? Math.max(0, startLoan - (startLoan / loanYears) * year) : 0;
      return {
        year: `${year}`,
        value: Math.round(value),
        equity: Math.round(value - balance),
      };
    });
  }, [rental, analysis.equity, linkedLoan]);

  return (
    <div className="bg-card rounded-2xl p-8 border border-border shadow-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Input
            value={rental.label}
            onChange={(e) => actions.updateRental(rental.id, { label: e.target.value })}
            className="font-display text-lg h-10 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
          />
          <p className="text-xs text-muted-foreground mt-1">{getMortgageDisplay()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-sm font-semibold transition hover:bg-muted/80"
          >
            Szczegóły
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              const copy = { ...rental };
              actions.removeRental(rental.id);
              toast(`Usunięto wynajem: ${rental.label}`, {
                action: {
                  label: "Cofnij",
                  onClick: () => {
                    const { id, ...rest } = copy;
                    actions.addRental(rest as any);
                  },
                },
                duration: 5000,
              });
            }}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-2 rounded-lg"
            aria-label={`Usuń wynajem: ${rental.label}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl border border-border bg-muted p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cashflow / m-c</p>
          <p className={`mt-2 font-mono text-lg font-semibold ${analysis.monthlyCashflow >= 0 ? "text-success" : "text-destructive"}`}>
            {formatPLN2(analysis.monthlyCashflow)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wartość</p>
          <p className="mt-2 font-mono text-lg font-semibold">{formatPLN(rental.marketValue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Yield brutto</p>
          <p className="mt-2 font-mono text-lg font-semibold">{analysis.grossYieldPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Equity</p>
          <p className="mt-2 font-mono text-lg font-semibold">{formatPLN(analysis.equity)}</p>
        </div>
      </div>

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button type="button" className="sr-only">Toggle rental details</button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4 border-t border-border">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">A. Nabycie i finansowanie</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Cena zakupu">
                  <LocalNumInput
                    value={rental.purchasePrice ?? 0}
                    onChange={(v) => actions.updateRental(rental.id, { purchasePrice: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
                <Field label="Data zakupu">
                  <Input
                    type="date"
                    value={rental.purchaseDate ?? ""}
                    onChange={(e) => actions.updateRental(rental.id, { purchaseDate: e.target.value })}
                    className="h-10"
                  />
                </Field>
                <Field label="Koszt remontu">
                  <LocalNumInput
                    value={rental.renovationCost ?? 0}
                    onChange={(v) => actions.updateRental(rental.id, { renovationCost: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
                <Field label="Koszty transakcyjne %">
                  <LocalNumInput
                    value={rental.closingCostsPct ?? 2.5}
                    onChange={(v) => actions.updateRental(rental.id, { closingCostsPct: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={2}
                  />
                </Field>
                <Field label="Powiązany kredyt">
                  <Select
                    value={rental.linkedLoanId ?? "none"}
                    onValueChange={(value) =>
                      actions.updateRental(rental.id, {
                        linkedLoanId: value === "none" ? undefined : value,
                        hasLoanLink: value !== "none",
                      })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Brak" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Brak powiązania</SelectItem>
                      {loans.map((loan) => (
                        <SelectItem key={loan.id} value={loan.id}>
                          {loan.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Rata kredytu / m-c">
                  <LocalNumInput
                    value={linkedLoan ? monthlyPayment(linkedLoan.principal, linkedLoan.annualRatePct, linkedLoan.monthsRemaining) + (linkedLoan.mortgageInsuranceMonthly ?? 0) : rental.mortgageMonthly ?? rental.monthlyMortgage}
                    onChange={(v) => actions.updateRental(rental.id, { mortgageMonthly: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
                <Field label="Ubezpieczenie / m-c">
                  <LocalNumInput
                    value={rental.mortgageInsuranceMonthly ?? 0}
                    onChange={(v) => actions.updateRental(rental.id, { mortgageInsuranceMonthly: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">B. Wynajem i koszty</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Czynsz brutto / m-c">
                  <LocalNumInput
                    value={rental.monthlyRent}
                    onChange={(v) => actions.updateRental(rental.id, { monthlyRent: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
                <Field label="Puste miesiące / rok">
                  <div className="space-y-2">
                    <Slider
                      value={[rental.vacancyMonthsPerYear ?? 0]}
                      min={0}
                      max={3}
                      step={0.5}
                      onValueChange={(value) =>
                        actions.updateRental(rental.id, { vacancyMonthsPerYear: value[0] })
                      }
                    />
                    <div className="text-xs text-muted-foreground">{rental.vacancyMonthsPerYear ?? 0} mies.</div>
                  </div>
                </Field>
                <Field label="Koszty / m-c">
                  <LocalNumInput
                    value={rental.monthlyCosts}
                    onChange={(v) => actions.updateRental(rental.id, { monthlyCosts: v })}
                    className="h-10 font-mono tabular-nums"
                    decimals={0}
                  />
                </Field>
                <Field label="Podatek">
                  <Select
                    value={(rental.taxRatePct ?? 8.5).toString()}
                    onValueChange={(value) =>
                      actions.updateRental(rental.id, { taxRatePct: parseLocaleAmount(value) })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[8.5, 12.5, 12].map((rate) => (
                        <SelectItem key={rate} value={rate.toString()}>
                          {rate}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">C. Prognozy</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Field label="Wzrost wartości % rocznie">
                  <div className="space-y-2">
                    <Slider
                      value={[rental.appreciationPct ?? 4]}
                      min={0}
                      max={10}
                      step={0.1}
                      onValueChange={(value) =>
                        actions.updateRental(rental.id, { appreciationPct: value[0] })
                      }
                    />
                    <div className="text-xs text-muted-foreground">{(rental.appreciationPct ?? 4).toFixed(1)}%</div>
                  </div>
                </Field>
                <Field label="Wzrost czynszu % rocznie">
                  <div className="space-y-2">
                    <Slider
                      value={[rental.rentGrowthPct ?? 3]}
                      min={0}
                      max={8}
                      step={0.1}
                      onValueChange={(value) =>
                        actions.updateRental(rental.id, { rentGrowthPct: value[0] })
                      }
                    />
                    <div className="text-xs text-muted-foreground">{(rental.rentGrowthPct ?? 3).toFixed(1)}%</div>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">D. Analiza inwestycji</p>
              <div className="grid gap-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cashflow / m-c">
                    <div className="text-sm font-semibold">{formatPLN2(analysis.monthlyCashflow)}</div>
                  </Field>
                  <Field label="Podatek / m-c">
                    <div className="text-sm font-semibold">{formatPLN2(analysis.monthlyTax)}</div>
                  </Field>
                  <Field label="ROI">
                    <div className="text-sm font-semibold">{analysis.roi.toFixed(1)}%</div>
                  </Field>
                  <Field label="Yield netto">
                    <div className="text-sm font-semibold">{analysis.netYieldPct.toFixed(1)}%</div>
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Wkład</p>
                    <p className="mt-2 font-mono font-semibold">{formatPLN(analysis.totalInvestedCash)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Equity</p>
                    <p className="mt-2 font-mono font-semibold">{formatPLN(analysis.equity)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">CAGR (szac.)</p>
                    <p className="mt-2 font-mono font-semibold">{analysis.irrEstimate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number) => formatPLN2(value)} />
                      <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="url(#valueGradient)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="equity" stroke="var(--foreground)" fill="url(#equityGradient)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function LocalNumInput({
  value,
  onChange,
  className = "",
  placeholder = "",
  decimals = 2,
  readOnly = false,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  decimals?: number;
  readOnly?: boolean;
}) {
  const [localValue, setLocalValue] = useState<string>(formatLocaleAmount(value, decimals));

  useEffect(() => {
    const parsedLocal = parseLocaleAmount(localValue);
    if (parsedLocal !== value) {
      setLocalValue(formatLocaleAmount(value, decimals));
    }
  }, [value, decimals]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(parseLocaleAmount(e.target.value));
      }}
      onBlur={() => setLocalValue(formatLocaleAmount(value, decimals))}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
    />
  );
}

function AddLoanDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    principal: 0,
    annualRatePct: 7.5,
    monthsRemaining: 240,
    monthlyOverpayment: 0,
    overpaymentType: "fixed" as "fixed" | "dynamic",
    mortgageInsuranceMonthly: 0,
    paymentDayOfMonth: undefined as number | undefined,
  });
  const [isInsuranceManual, setIsInsuranceManual] = useState(false);

  const draftPmt = monthlyPayment(
    draft.principal,
    draft.annualRatePct,
    draft.monthsRemaining,
  );
  const draftTotal = draftPmt + draft.mortgageInsuranceMonthly + draft.monthlyOverpayment;

  // Auto-calculate insurance: 0.04% of principal monthly
  useEffect(() => {
    if (!isInsuranceManual && draft.principal > 0) {
      const suggested = Math.round(draft.principal * 0.0004);
      setDraft((prev) => ({ ...prev, mortgageInsuranceMonthly: suggested }));
    }
  }, [draft.principal, isInsuranceManual]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full px-5 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Dodaj kredyt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Dodaj kredyt / zobowiązanie</DialogTitle>
          <DialogDescription>
            Wprowadź dane kredytu. Ustaw dzień płatności, a system automatycznie będzie
            rejestrować spłaty w wyznaczony dzień każdego miesiąca.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.label.trim() || draft.principal <= 0) return;
            actions.addLoan(draft);
            setDraft({
              label: "",
              principal: 0,
              annualRatePct: 7.5,
              monthsRemaining: 240,
              monthlyOverpayment: 0,
              overpaymentType: "fixed",
              mortgageInsuranceMonthly: 0,
              paymentDayOfMonth: undefined,
            });
            setIsInsuranceManual(false);
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Nazwa</label>
            <Input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="np. Hipoteka Mokotów"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Kapitał</label>
            <LocalNumInput
              value={draft.principal}
              onChange={(v) => setDraft({ ...draft, principal: v })}
              placeholder="np. 400000"
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Oproc. (%)</label>
            <LocalNumInput
              value={draft.annualRatePct}
              onChange={(v) => setDraft({ ...draft, annualRatePct: v })}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={2}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Pozostało m-cy</label>
            <Input
              type="number"
              value={draft.monthsRemaining || ""}
              onChange={(e) =>
                setDraft({ ...draft, monthsRemaining: parseInt(e.target.value) || 0 })
              }
              className="col-span-3 font-mono tabular-nums h-10"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">
              Ubezpieczenie
            </label>
            <LocalNumInput
              value={draft.mortgageInsuranceMonthly}
              onChange={(v) => {
                setDraft({ ...draft, mortgageInsuranceMonthly: v });
                setIsInsuranceManual(true);
              }}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
            {!isInsuranceManual && draft.principal > 0 && (
              <p className="col-start-2 col-span-3 text-[10px] -mt-3 italic">
                Sugerowane: 0.04% kapitału (miesięcznie)
              </p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">
              {draft.overpaymentType === "dynamic" ? "Suma miesięczna" : "Nadpłata / m-c"}
            </label>
            <LocalNumInput
              value={draft.overpaymentType === "dynamic" ? draftTotal : draft.monthlyOverpayment}
              onChange={(v) => {
                if (draft.overpaymentType === "dynamic") {
                  setDraft({ ...draft, monthlyOverpayment: Math.max(0, v - draftPmt - draft.mortgageInsuranceMonthly) });
                } else {
                  setDraft({ ...draft, monthlyOverpayment: v });
                }
              }}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">
              Model nadpłaty
            </label>
            <div className="col-span-3 grid grid-cols-2 gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, overpaymentType: "fixed" })}
                className={cn(
                  "py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all",
                  draft.overpaymentType === "fixed"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80",
                )}
              >
                Stała kwota
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, overpaymentType: "dynamic" })}
                className={cn(
                  "py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all",
                  draft.overpaymentType === "dynamic"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80",
                )}
              >
                Dynamiczna
              </button>
            </div>
            {draft.overpaymentType === "dynamic" && (
              <p className="col-start-2 col-span-3 text-[10px] text-muted-foreground -mt-3 italic leading-tight">
                Stała suma wydatków: raty będą spadać, a nadpłaty rosnąć.
              </p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Dzień płatności</label>
            <Select
              value={draft.paymentDayOfMonth?.toString() ?? ""}
              onValueChange={(v) =>
                setDraft({ ...draft, paymentDayOfMonth: v ? parseInt(v) : undefined })
              }
            >
              <SelectTrigger className="col-span-3 h-10">
                <SelectValue placeholder="Nie śledzę" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Dzień {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0">Dodaj kredyt</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRentalDialog() {
  const loans = useAppState((s) => s.loans);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isMortgageMonthlyManual, setIsMortgageMonthlyManual] = useState(false);
  const [isInsuranceManual, setIsInsuranceManual] = useState(false);

  type RentalDraft = Omit<Rental, "id"> & {
    loanMode: "none" | "link" | "manual";
  } & Required<Pick<Rental, "purchasePrice" | "mortgageRatePct" | "mortgageYears" | "mortgageRemaining" | "mortgageMonthly" | "mortgageInsuranceMonthly">>;

  const [draft, setDraft] = useState<RentalDraft>({
    label: "",
    monthlyRent: 0,
    monthlyCosts: 0,
    monthlyMortgage: 0,
    taxRatePct: 8.5,
    marketValue: 0,
    purchasePrice: 0,
    purchaseDate: "",
    renovationCost: 0,
    closingCostsPct: 2.5,
    hasLoanLink: false,
    linkedLoanId: undefined,
    mortgageRatePct: 0,
    mortgageYears: 240,
    mortgageRemaining: 240,
    mortgageMonthly: 0,
    mortgageInsuranceMonthly: 0,
    appreciationPct: 4,
    rentGrowthPct: 3,
    vacancyMonthsPerYear: 0,
    loanMode: "none",
  });

  const loanPrincipal = Math.max(
    0,
    (draft.purchasePrice || draft.marketValue || 0) + (draft.renovationCost || 0),
  );
  const calculatedMortgageMonthly =
    draft.loanMode === "manual" && draft.mortgageRatePct > 0 && draft.mortgageRemaining > 0
      ? monthlyPayment(loanPrincipal, draft.mortgageRatePct, draft.mortgageRemaining)
      : 0;
  const displayMortgageMonthly = isMortgageMonthlyManual
    ? draft.mortgageMonthly ?? calculatedMortgageMonthly
    : calculatedMortgageMonthly;
  const totalMortgageCost = Math.round((displayMortgageMonthly + (draft.mortgageInsuranceMonthly || 0)) * 100) / 100;

  useEffect(() => {
    if (!isInsuranceManual && loanPrincipal > 0) {
      const suggestedInsurance = Math.round(loanPrincipal * 0.0004);
      setDraft((prev) => ({ ...prev, mortgageInsuranceMonthly: suggestedInsurance }));
    }
  }, [loanPrincipal, isInsuranceManual]);

  useEffect(() => {
    if (
      draft.loanMode === "manual" &&
      !isMortgageMonthlyManual &&
      loanPrincipal > 0 &&
      draft.mortgageRatePct > 0 &&
      draft.mortgageRemaining > 0
    ) {
      setDraft((prev) => ({ ...prev, mortgageMonthly: calculatedMortgageMonthly }));
    }
  }, [calculatedMortgageMonthly, draft.loanMode, draft.mortgageRatePct, draft.mortgageRemaining, loanPrincipal, isMortgageMonthlyManual]);

  const canProceedStep1 = draft.label.trim().length > 0 && (draft.purchasePrice > 0 || draft.marketValue > 0);
  const canProceedStep2 =
    draft.loanMode === "none" ||
    (draft.loanMode === "link" && !!draft.linkedLoanId) ||
    draft.loanMode === "manual";
  const canSubmit = draft.monthlyRent > 0 && draft.taxRatePct > 0;

  const previewRental: Rental = useMemo(
    () => ({
      id: "preview",
      label: draft.label,
      monthlyRent: draft.monthlyRent,
      monthlyCosts: draft.monthlyCosts,
      monthlyMortgage: draft.loanMode === "link" ? 0 : draft.mortgageMonthly ?? draft.monthlyMortgage,
      taxRatePct: draft.taxRatePct,
      marketValue: draft.marketValue || draft.purchasePrice,
      purchasePrice: draft.purchasePrice,
      purchaseDate: draft.purchaseDate,
      renovationCost: draft.renovationCost,
      closingCostsPct: draft.closingCostsPct,
      hasLoanLink: draft.loanMode === "link",
      linkedLoanId: draft.loanMode === "link" ? draft.linkedLoanId : undefined,
      mortgageRatePct: draft.loanMode === "manual" ? draft.mortgageRatePct : undefined,
      mortgageYears: draft.loanMode === "manual" ? draft.mortgageYears : undefined,
      mortgageRemaining: draft.loanMode === "manual" ? draft.mortgageRemaining : undefined,
      mortgageMonthly: draft.loanMode === "manual" ? draft.mortgageMonthly : undefined,
      mortgageInsuranceMonthly: draft.loanMode === "manual" ? draft.mortgageInsuranceMonthly : undefined,
      appreciationPct: draft.appreciationPct,
      rentGrowthPct: draft.rentGrowthPct,
      vacancyMonthsPerYear: draft.vacancyMonthsPerYear,
    }),
    [draft],
  );

  const previewAnalysis = analyzeRental(previewRental, loans);

  const resetDraft = () => {
    setStep(1);
    setIsMortgageMonthlyManual(false);
    setIsInsuranceManual(false);
    setDraft({
      label: "",
      monthlyRent: 0,
      monthlyCosts: 0,
      monthlyMortgage: 0,
      taxRatePct: 8.5,
      marketValue: 0,
      purchasePrice: 0,
      purchaseDate: "",
      renovationCost: 0,
      closingCostsPct: 2.5,
      hasLoanLink: false,
      linkedLoanId: undefined,
      mortgageRatePct: 0,
      mortgageYears: 240,
      mortgageRemaining: 240,
      mortgageMonthly: 0,
      mortgageInsuranceMonthly: 0,
      appreciationPct: 4,
      rentGrowthPct: 3,
      vacancyMonthsPerYear: 0,
      loanMode: "none",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) resetDraft();
    }}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full px-5 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Dodaj nieruchomość
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Dodaj nieruchomość</DialogTitle>
          <DialogDescription>Wprowadź podstawowe dane, finansowanie i parametry wynajmu.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            const rentalToSave: Omit<Rental, "id"> = {
              label: draft.label.trim(),
              monthlyRent: draft.monthlyRent,
              monthlyCosts: draft.monthlyCosts,
              monthlyMortgage: draft.loanMode === "link" ? 0 : draft.mortgageMonthly ?? draft.monthlyMortgage,
              taxRatePct: draft.taxRatePct,
              marketValue: draft.marketValue || draft.purchasePrice,
              purchasePrice: draft.purchasePrice,
              purchaseDate: draft.purchaseDate,
              renovationCost: draft.renovationCost,
              closingCostsPct: draft.closingCostsPct,
              hasLoanLink: draft.loanMode === "link",
              linkedLoanId: draft.loanMode === "link" ? draft.linkedLoanId : undefined,
              mortgageRatePct: draft.loanMode === "manual" ? draft.mortgageRatePct : undefined,
              mortgageYears: draft.loanMode === "manual" ? draft.mortgageYears : undefined,
              mortgageRemaining: draft.loanMode === "manual" ? draft.mortgageRemaining : undefined,
              mortgageMonthly: draft.loanMode === "manual" ? draft.mortgageMonthly : undefined,
              mortgageInsuranceMonthly: draft.loanMode === "manual" ? draft.mortgageInsuranceMonthly : undefined,
              appreciationPct: draft.appreciationPct,
              rentGrowthPct: draft.rentGrowthPct,
              vacancyMonthsPerYear: draft.vacancyMonthsPerYear,
            };
            actions.addRental(rentalToSave);
            resetDraft();
            setOpen(false);
          }}
        >
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Nazwa</label>
                <Input
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="np. Kawalerka centrum"
                  className="col-span-3 h-10"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Cena zakupu</label>
                <LocalNumInput
                  value={draft.purchasePrice ?? 0}
                  onChange={(v) => setDraft({ ...draft, purchasePrice: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={0}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Wartość rynkowa</label>
                <LocalNumInput
                  value={draft.marketValue ?? 0}
                  onChange={(v) => setDraft({ ...draft, marketValue: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={0}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Data zakupu</label>
                <Input
                  type="date"
                  value={draft.purchaseDate ?? ""}
                  onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })}
                  className="col-span-3 h-10"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Masz kredyt?</label>
                <div className="col-span-3 grid grid-cols-3 gap-2">
                  {(["none", "link", "manual"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, loanMode: mode });
                        if (mode !== "manual") setIsMortgageMonthlyManual(false);
                      }}
                      className={cn(
                        "rounded-full px-3 py-2 text-sm font-semibold transition",
                        draft.loanMode === mode
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {mode === "none" ? "Brak kredytu" : mode === "link" ? "Powiąż istniejący" : "Wprowadź ręcznie"}
                    </button>
                  ))}
                </div>
              </div>

              {draft.loanMode === "link" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-sm font-medium">Wybierz kredyt</label>
                  <Select
                    value={draft.linkedLoanId ?? ""}
                    onValueChange={(value) => setDraft({ ...draft, linkedLoanId: value || undefined })}
                  >
                    <SelectTrigger className="col-span-3 h-10">
                      <SelectValue placeholder="Wybierz kredyt" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.map((loan) => (
                        <SelectItem key={loan.id} value={loan.id}>
                          {loan.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.loanMode === "manual" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Oprocentowanie %</label>
                    <LocalNumInput
                      value={draft.mortgageRatePct ?? 0}
                      onChange={(v) => setDraft({ ...draft, mortgageRatePct: v })}
                      className="col-span-3 font-mono tabular-nums h-10"
                      decimals={2}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Pozostałe m-cy</label>
                    <Input
                      type="number"
                      value={draft.mortgageRemaining ?? 0}
                      onChange={(e) => setDraft({ ...draft, mortgageRemaining: parseInt(e.target.value) || 0 })}
                      className="col-span-3 font-mono tabular-nums h-10"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Rata kredytu (kapitał + odsetki)</label>
                    <div className="col-span-3 space-y-2">
                      <LocalNumInput
                        value={displayMortgageMonthly}
                        onChange={(v) => {
                          setDraft({ ...draft, mortgageMonthly: v });
                          setIsMortgageMonthlyManual(true);
                        }}
                        className="w-full font-mono tabular-nums h-10"
                        decimals={0}
                        readOnly={!isMortgageMonthlyManual}
                      />
                      <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                        <p>
                          {isMortgageMonthlyManual
                            ? "Ręczne nadpisanie raty"
                            : `Obliczona automatycznie z kwoty kredytu ${formatPLN(loanPrincipal)}.`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsMortgageMonthlyManual((prev) => !prev)}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold transition hover:bg-muted/80"
                        >
                          {isMortgageMonthlyManual ? "Przywróć auto" : "Nadpisz ręcznie"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Ubezpieczenie / m-c</label>
                    <LocalNumInput
                      value={draft.mortgageInsuranceMonthly ?? 0}
                      onChange={(v) => {
                        setDraft({ ...draft, mortgageInsuranceMonthly: v });
                        setIsInsuranceManual(true);
                      }}
                      className="col-span-3 font-mono tabular-nums h-10"
                      decimals={0}
                    />
                    {!isInsuranceManual && loanPrincipal > 0 && (
                      <p className="col-start-2 col-span-3 text-[10px] -mt-3 italic text-muted-foreground">
                        Sugerowane: 0.04% kwoty kredytu ({formatPLN(Math.round(loanPrincipal * 0.0004))})
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Rata razem</label>
                    <Input
                      value={formatLocaleAmount(totalMortgageCost, 0)}
                      readOnly
                      className="col-span-3 font-mono tabular-nums h-10 bg-muted/70"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Koszty transakcyjne %</label>
                <LocalNumInput
                  value={draft.closingCostsPct ?? 2.5}
                  onChange={(v) => setDraft({ ...draft, closingCostsPct: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={2}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Koszt remontu</label>
                <LocalNumInput
                  value={draft.renovationCost ?? 0}
                  onChange={(v) => setDraft({ ...draft, renovationCost: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={0}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Czynsz / m-c</label>
                <LocalNumInput
                  value={draft.monthlyRent}
                  onChange={(v) => setDraft({ ...draft, monthlyRent: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={0}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Koszty / m-c</label>
                <LocalNumInput
                  value={draft.monthlyCosts}
                  onChange={(v) => setDraft({ ...draft, monthlyCosts: v })}
                  className="col-span-3 font-mono tabular-nums h-10"
                  decimals={0}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Podatek</label>
                <Select
                  value={(draft.taxRatePct ?? 8.5).toString()}
                  onValueChange={(value) => setDraft({ ...draft, taxRatePct: parseLocaleAmount(value) })}
                >
                  <SelectTrigger className="col-span-3 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[8.5, 12.5, 12].map((rate) => (
                      <SelectItem key={rate} value={rate.toString()}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Puste miesiące / rok</label>
                <div className="col-span-3 space-y-2">
                  <Slider
                    value={[draft.vacancyMonthsPerYear ?? 0]}
                    min={0}
                    max={3}
                    step={0.5}
                    onValueChange={(value) => setDraft({ ...draft, vacancyMonthsPerYear: value[0] })}
                  />
                  <div className="text-xs text-muted-foreground">{draft.vacancyMonthsPerYear ?? 0} mies.</div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-2">Podsumowanie</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Cashflow / m-c</p>
                <p className="font-semibold">{formatPLN2(previewAnalysis.monthlyCashflow)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Yield brutto</p>
                <p className="font-semibold">{previewAnalysis.grossYieldPct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Equity</p>
                <p className="font-semibold">{formatPLN(previewAnalysis.equity)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CAGR (szac.)</p>
                <p className="font-semibold">{previewAnalysis.irrEstimate.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((value) => Math.max(1, value - 1))}
              disabled={step === 1}
            >
              Wstecz
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep((value) => Math.min(3, value + 1))}
                disabled={!((step === 1 && canProceedStep1) || (step === 2 && canProceedStep2))}
              >
                Dalej
              </Button>
            ) : (
              <Button type="submit" disabled={!canSubmit}>
                Dodaj nieruchomość
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── SAVINGS HELPERS ─────────────────────────────────────────────────── */
const BELKA_TAX = 0.19;

function lokataGrossInterest(principal: number, ratePct: number, months: number): number {
  return principal * (ratePct / 100) * (months / 12);
}

function lokataNetInterest(principal: number, ratePct: number, months: number): number {
  return lokataGrossInterest(principal, ratePct, months) * (1 - BELKA_TAX);
}

function lokataMaturityDate(startDate: string, months: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

function daysUntilMaturity(startDate: string, months: number): number {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return Math.max(0, Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function lokataProgressPct(startDate: string, months: number): number {
  const start = new Date(startDate).getTime();
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + months);
  const total = end.getTime() - start;
  const elapsed = Date.now() - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/* ─── SAVINGS SECTION ─────────────────────────────────────────────────── */
function SavingsSection() {
  const savings = useAppState((s) => s.savings);
  const [view, setView] = useState<"list" | "summary">("list");

  const totalBalance = savings.reduce((acc, a) => acc + a.balance, 0);
  const totalWithInterest = savings.reduce((acc, a) => {
    if (a.type === "lokata" && a.ratePct > 0 && (a.lokataDurationMonths ?? 0) > 0) {
      return acc + a.balance + lokataNetInterest(a.balance, a.ratePct, a.lokataDurationMonths!);
    }
    return acc + a.balance;
  }, 0);
  const totalNetGain = totalWithInterest - totalBalance;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Łącznie {formatPLN(totalBalance)}</p>
          {savings.length > 0 && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setView("list")}
                className={`px-2.5 py-1 transition-colors ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Lista
              </button>
              <button
                onClick={() => setView("summary")}
                className={`px-2.5 py-1 transition-colors ${view === "summary" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Podsumowanie
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AddSavingsDialog />
        </div>
      </div>

      {savings.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Brak oszczędności"
          description="Dodaj konta bankowe, oszczędnościowe lub lokaty, aby mieć pełny obraz płynnych środków w swoim budżecie."
          className="my-8"
        />
      )}

      {/* ── IMPROVED SUMMARY VIEW ── */}
      {view === "summary" && savings.length > 0 && (
        <SavingsSummaryView
          savings={savings}
          totalBalance={totalBalance}
          totalWithInterest={totalWithInterest}
          totalNetGain={totalNetGain}
        />
      )}

      {/* LIST VIEW */}
      {view === "list" && savings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
          {savings.map((account) => (
            <SavingsCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── SAVINGS SUMMARY VIEW (redesigned) ─────────────────────────────── */
function SavingsSummaryView({
  savings,
  totalBalance,
  totalWithInterest,
  totalNetGain,
}: {
  savings: SavingsAccount[];
  totalBalance: number;
  totalWithInterest: number;
  totalNetGain: number;
}) {
  const lokaty = savings.filter((a) => a.type === "lokata");
  const accounts = savings.filter((a) => a.type !== "lokata");

  // Sort accounts by rate descending
  const accountsByRate = [...accounts].sort((a, b) => b.ratePct - a.ratePct);
  const lokatyByMaturity = [...lokaty].sort((a, b) => {
    if (!a.lokataStartDate || !a.lokataDurationMonths) return 1;
    if (!b.lokataStartDate || !b.lokataDurationMonths) return -1;
    return (
      daysUntilMaturity(a.lokataStartDate, a.lokataDurationMonths) -
      daysUntilMaturity(b.lokataStartDate, b.lokataDurationMonths)
    );
  });

  const avgRate =
    accounts.filter((a) => a.ratePct > 0).length > 0
      ? accounts
        .filter((a) => a.ratePct > 0)
        .reduce((s, a) => s + (a.ratePct * a.balance) / totalBalance, 0)
      : 0;

  const maxRate = Math.max(...savings.map((a) => a.ratePct), 0);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Saldo łączne
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">{formatPLN(totalBalance)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Po odsetkach
          </p>
          <p className="text-2xl font-bold tabular-nums font-display text-emerald-500">
            {formatPLN(totalWithInterest)}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Zysk netto
          </p>
          <p
            className={`text-2xl font-bold tabular-nums font-display ${totalNetGain > 0 ? "text-emerald-500" : "text-muted-foreground"}`}
          >
            {totalNetGain > 0 ? "+" : ""}
            {formatPLN(totalNetGain)}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Kont
          </p>
          <p className="text-2xl font-bold font-display">{savings.length}</p>
          {lokaty.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {lokaty.length} {lokaty.length === 1 ? "lokata" : "lokat"} · {accounts.length} kont
            </p>
          )}
        </div>
      </div>

      {/* Main content: lokaty + accounts side by side */}
      <div
        className={`grid gap-4 ${lokaty.length > 0 && accounts.length > 0 ? "lg:grid-cols-2" : ""}`}
      >
        {/* Lokaty section */}
        {lokatyByMaturity.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-amber-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Lokaty terminowe ({lokatyByMaturity.length})
                </p>
              </div>
              <p className="text-xs font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {formatPLN(lokatyByMaturity.reduce((s, a) => s + a.balance, 0))}
              </p>
            </div>
            <div className="divide-y divide-border">
              {lokatyByMaturity.map((a) => {
                const net =
                  a.ratePct > 0 && a.lokataDurationMonths
                    ? lokataNetInterest(a.balance, a.ratePct, a.lokataDurationMonths)
                    : 0;
                const gross =
                  a.ratePct > 0 && a.lokataDurationMonths
                    ? lokataGrossInterest(a.balance, a.ratePct, a.lokataDurationMonths)
                    : 0;
                const days =
                  a.lokataStartDate && a.lokataDurationMonths
                    ? daysUntilMaturity(a.lokataStartDate, a.lokataDurationMonths)
                    : null;
                const progress =
                  a.lokataStartDate && a.lokataDurationMonths
                    ? lokataProgressPct(a.lokataStartDate, a.lokataDurationMonths)
                    : 0;
                const isExpired = days !== null && days === 0;
                const isNearExpiry = days !== null && days > 0 && days <= 14;

                return (
                  <div key={a.id} className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{a.bank}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                            {a.ratePct.toFixed(2)}% p.a.
                          </span>
                          {isExpired && (
                            <span className="bg-destructive/15 text-destructive text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                              WYGASŁA
                            </span>
                          )}
                          {isNearExpiry && (
                            <span className="bg-warning/20 text-warning-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                              {days}d
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-sm tabular-nums">
                          {formatPLN(a.balance)}
                        </p>
                        {net > 0 && (
                          <p className="text-[11px] text-emerald-500 font-mono">
                            +{formatPLN(net)} netto
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {a.lokataStartDate && a.lokataDurationMonths && (
                      <div className="space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isExpired
                              ? "bg-destructive"
                              : isNearExpiry
                                ? "bg-warning"
                                : "bg-emerald-500"
                              }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>
                            {new Date(a.lokataStartDate).toLocaleDateString("pl-PL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="font-medium">
                            {isExpired
                              ? "zapadalność minęła"
                              : days !== null
                                ? `${days} dni do zapadalności`
                                : ""}
                          </span>
                          <span>
                            {lokataMaturityDate(a.lokataStartDate, a.lokataDurationMonths)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Interest breakdown */}
                    {gross > 0 && (
                      <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-lg p-2.5 text-center">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Czas</p>
                          <p className="text-xs font-semibold">{a.lokataDurationMonths} mies.</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Brutto</p>
                          <p className="text-xs font-mono font-semibold text-amber-600">
                            +{formatPLN(gross)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Netto (−Belka)</p>
                          <p className="text-xs font-mono font-semibold text-emerald-600">
                            +{formatPLN(net)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <EditSavingsDialog account={a} />
                      <button
                        onClick={() => {
                          const copy = { ...a };
                          actions.removeSavings(a.id);
                          toast(`Usunięto lokatę: ${a.bank}`, {
                            action: {
                              label: "Cofnij",
                              onClick: () => {
                                const { id, ...rest } = copy;
                                actions.addSavings(rest as any);
                              },
                            },
                            duration: 5000,
                          });
                        }}
                        className="text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors px-2 py-1 rounded-lg flex items-center gap-1"
                        aria-label={`Usuń lokatę: ${a.bank}`}
                      >
                        <Trash2 className="w-3 h-3" /> Usuń
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular accounts section */}
        {accountsByRate.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Konta bankowe ({accountsByRate.length})
                </p>
              </div>
              <p className="text-xs font-mono font-semibold tabular-nums text-muted-foreground">
                {formatPLN(accountsByRate.reduce((s, a) => s + a.balance, 0))}
              </p>
            </div>
            <div className="divide-y divide-border">
              {accountsByRate.map((a) => {
                const balancePct = totalBalance > 0 ? (a.balance / totalBalance) * 100 : 0;
                const ratePct = maxRate > 0 ? (a.ratePct / maxRate) * 100 : 0;

                return (
                  <div key={a.id} className="px-5 py-4 group">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{a.bank}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ACCOUNT_TYPE_LABEL[a.type]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-sm tabular-nums">
                          {formatPLN(a.balance)}
                        </p>
                        {a.ratePct > 0 ? (
                          <p className="text-[11px] text-emerald-600 font-mono font-semibold">
                            {a.ratePct.toFixed(2)}% p.a.
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">bez oprocentowania</p>
                        )}
                      </div>
                    </div>

                    {/* Balance bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>udział w oszczędnościach</span>
                        <span>{balancePct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/70"
                          style={{ width: `${balancePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Rate bar (relative to best rate) */}
                    {a.ratePct > 0 && maxRate > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>oprocentowanie vs najlepsze ({maxRate.toFixed(2)}%)</span>
                          <span
                            className={
                              ratePct >= 90
                                ? "text-emerald-600 font-medium"
                                : ratePct < 50
                                  ? "text-destructive"
                                  : ""
                            }
                          >
                            {ratePct.toFixed(0)}% max
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${ratePct >= 90
                              ? "bg-emerald-500"
                              : ratePct >= 60
                                ? "bg-amber-500"
                                : "bg-muted-foreground/40"
                              }`}
                            style={{ width: `${ratePct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <EditSavingsDialog account={a} />
                      <button
                        onClick={() => {
                          const copy = { ...a };
                          actions.removeSavings(a.id);
                          toast(`Usunięto konto: ${a.bank}`, {
                            action: {
                              label: "Cofnij",
                              onClick: () => {
                                const { id, ...rest } = copy;
                                actions.addSavings(rest as any);
                              },
                            },
                            duration: 5000,
                          });
                        }}
                        className="text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors px-2 py-1 rounded-lg flex items-center gap-1"
                        aria-label={`Usuń konto: ${a.bank}`}
                      >
                        <Trash2 className="w-3 h-3" /> Usuń
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Average rate footer */}
            {avgRate > 0 && (
              <div className="px-5 py-3 border-t border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground">
                  Średnie oprocentowanie ważone saldem:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {avgRate.toFixed(2)}% p.a.
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Combined snapshot: all accounts sorted by balance */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Wszystkie konta
          </p>
        </div>
        <div className="divide-y divide-border">
          {[...savings]
            .sort((a, b) => b.balance - a.balance)
            .map((a) => {
              const pct = totalBalance > 0 ? (a.balance / totalBalance) * 100 : 0;
              const net =
                a.type === "lokata" && a.ratePct > 0 && a.lokataDurationMonths
                  ? lokataNetInterest(a.balance, a.ratePct, a.lokataDurationMonths)
                  : null;
              const days =
                a.type === "lokata" && a.lokataStartDate && a.lokataDurationMonths
                  ? daysUntilMaturity(a.lokataStartDate, a.lokataDurationMonths)
                  : null;

              return (
                <div
                  key={a.id}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Type badge */}
                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${a.type === "lokata"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : a.type === "oszczędnościowe"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {a.type === "lokata" ? "LOK" : a.type === "oszczędnościowe" ? "OSZ" : "ZWY"}
                  </span>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.bank}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.ratePct > 0 && (
                        <span className="text-[11px] font-mono text-emerald-600">
                          {a.ratePct.toFixed(2)}%
                        </span>
                      )}
                      {days !== null && (
                        <span
                          className={`text-[10px] ${days <= 14 ? "text-warning-foreground font-medium" : "text-muted-foreground"}`}
                        >
                          {days === 0 ? "wygasła" : `${days}d do zapadalności`}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="w-20 hidden sm:block">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold text-sm tabular-nums">
                      {formatPLN(a.balance)}
                    </p>
                    {net !== null && net > 0 && (
                      <p className="text-[11px] text-emerald-500 font-mono">+{formatPLN(net)}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_TYPE_LABEL: Record<SavingsAccount["type"], string> = {
  zwykłe: "Konto zwykłe",
  oszczędnościowe: "Konto oszczędnościowe",
  lokata: "Lokata terminowa",
};

function SavingsCard({ account }: { account: SavingsAccount }) {
  const isLokata = account.type === "lokata";
  const gross =
    isLokata &&
      account.ratePct > 0 &&
      account.balance > 0 &&
      (account.lokataDurationMonths ?? 0) > 0
      ? lokataGrossInterest(account.balance, account.ratePct, account.lokataDurationMonths!)
      : null;
  const net =
    gross !== null
      ? lokataNetInterest(account.balance, account.ratePct, account.lokataDurationMonths!)
      : null;
  const maturity =
    isLokata && account.lokataStartDate && account.lokataDurationMonths
      ? lokataMaturityDate(account.lokataStartDate, account.lokataDurationMonths)
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4 space-y-3 relative group">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{account.bank}</p>
          <p className="text-[11px] text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.type]}</p>
        </div>
        <div className="flex items-center gap-1">
          <EditSavingsDialog account={account} />
          <button
            onClick={() => {
              const copy = { ...account };
              actions.removeSavings(account.id);
              toast(`Usunięto lokatę: ${account.bank}`, {
                action: {
                  label: "Cofnij",
                  onClick: () => {
                    const { id, ...rest } = copy;
                    actions.addSavings(rest as any);
                  },
                },
                duration: 5000,
              });
            }}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-2 rounded-lg"
            aria-label={`Usuń lokatę: ${account.bank}`}
            title="Usuń"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums font-display">
          {formatPLN(account.balance)}
        </span>
        {account.ratePct > 0 && (
          <span className="text-xs text-emerald-500 font-semibold">
            {account.ratePct.toFixed(2)}% p.a.
          </span>
        )}
      </div>

      {isLokata && gross !== null && net !== null && (
        <div className="rounded-2xl bg-muted/50 p-3 space-y-2 text-xs border border-border/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Podsumowanie lokaty
          </p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kapitał</span>
            <span className="font-mono font-medium">{formatPLN(account.balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Czas trwania</span>
            <span className="font-medium">{account.lokataDurationMonths} mies.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Odsetki brutto</span>
            <span className="font-mono text-amber-500">+{formatPLN(gross)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Podatek Belki (19%)</span>
            <span className="font-mono text-destructive">−{formatPLN(gross - net)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border/50 pt-2 mt-2">
            <span>Wypłata netto</span>
            <span className="font-mono text-emerald-500">{formatPLN(account.balance + net)}</span>
          </div>
          {maturity && (
            <p className="text-[11px] text-muted-foreground pt-2">
              Zapadalność: <span className="font-medium text-foreground">{maturity}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ADD SAVINGS DIALOG ──────────────────────────────────────────────── */
function AddSavingsDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    bank: "",
    type: "oszczędnościowe" as SavingsAccount["type"],
    balance: "" as string,
    ratePct: "" as string,
    lokataStartDate: new Date().toISOString().slice(0, 10),
    lokataDurationMonths: 12,
    lokataCapitalization: "na końcu" as const,
  });

  const numBalance = parseLocaleAmount(draft.balance);
  const numRate = parseLocaleAmount(draft.ratePct);

  const isLokata = draft.type === "lokata";
  const gross =
    isLokata && numRate > 0 && numBalance > 0 && (draft.lokataDurationMonths ?? 0) > 0
      ? lokataGrossInterest(numBalance, numRate, draft.lokataDurationMonths!)
      : null;
  const net =
    gross !== null
      ? lokataNetInterest(numBalance, numRate, draft.lokataDurationMonths!)
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setDraft({
            bank: "",
            type: "oszczędnościowe",
            balance: "",
            ratePct: "",
            lokataStartDate: new Date().toISOString().slice(0, 10),
            lokataDurationMonths: 12,
            lokataCapitalization: "na końcu",
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full px-5 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Dodaj konto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Dodaj konto / lokatę</DialogTitle>
          <DialogDescription>
            {isLokata
              ? "Wprowadź dane lokaty - kalkulator wyliczy odsetki netto po podatku Belki."
              : "Dodaj konto bankowe z opcjonalnym oprocentowaniem."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.bank.trim() || numBalance <= 0) return;
            actions.addSavings({
              ...draft,
              balance: numBalance,
              ratePct: numRate
            } as any);
            setDraft({
              bank: "",
              type: "oszczędnościowe",
              balance: "",
              ratePct: "",
              lokataStartDate: new Date().toISOString().slice(0, 10),
              lokataDurationMonths: 12,
              lokataCapitalization: "na końcu",
            });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Bank</label>
            <Input
              value={draft.bank}
              onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
              placeholder="np. PKO BP, mBank, Revolut"
              className="col-span-3 h-10"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Typ konta</label>
            <Select value={draft.type} onValueChange={(v: any) => setDraft({ ...draft, type: v })}>
              <SelectTrigger className="col-span-3 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zwykłe">Konto zwykłe</SelectItem>
                <SelectItem value="oszczędnościowe">Konto oszczędnościowe</SelectItem>
                <SelectItem value="lokata">Lokata terminowa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">
              {isLokata ? "Kwota (PLN)" : "Saldo (PLN)"}
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.balance}
              onChange={(e) => setDraft({ ...draft, balance: e.target.value })}
              placeholder="np. 10 000"
              className="col-span-3 font-mono tabular-nums h-10"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Oprocentowanie %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.ratePct}
              onChange={(e) => setDraft({ ...draft, ratePct: e.target.value })}
              placeholder="np. 6.50"
              className="col-span-3 font-mono tabular-nums h-10"
            />
          </div>

          {isLokata && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Data otwarcia</label>
                <Input
                  type="date"
                  value={draft.lokataStartDate ?? ""}
                  onChange={(e) => setDraft({ ...draft, lokataStartDate: e.target.value })}
                  className="col-span-3 h-10"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Czas trwania</label>
                <Select
                  value={String(draft.lokataDurationMonths ?? 12)}
                  onValueChange={(v) => setDraft({ ...draft, lokataDurationMonths: parseInt(v) })}
                >
                  <SelectTrigger className="col-span-3 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 6, 9, 12, 18, 24, 36].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} {m === 1 ? "miesiąc" : m < 5 ? "miesiące" : "miesięcy"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Kapitalizacja</label>
                <Select
                  value={draft.lokataCapitalization ?? "na końcu"}
                  onValueChange={(v: any) => setDraft({ ...draft, lokataCapitalization: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="miesięczna">Miesięczna</SelectItem>
                    <SelectItem value="kwartalna">Kwartalna</SelectItem>
                    <SelectItem value="roczna">Roczna</SelectItem>
                    <SelectItem value="na końcu">Na końcu okresu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {gross !== null && net !== null && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-2">
                    Podgląd wyniku
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Odsetki brutto</span>
                    <span className="font-mono text-amber-500">+{formatPLN(gross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Podatek Belki (19%)</span>
                    <span className="font-mono text-destructive">−{formatPLN(gross - net)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1.5">
                    <span>Wypłata netto</span>
                    <span className="font-mono text-emerald-500">
                      {formatPLN(numBalance + net)}
                    </span>
                  </div>
                  {draft.lokataStartDate && draft.lokataDurationMonths && (
                    <p className="text-[11px] text-muted-foreground pt-0.5">
                      Termin zapadalności:{" "}
                      <span className="font-medium text-foreground">
                        {lokataMaturityDate(draft.lokataStartDate, draft.lokataDurationMonths)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!draft.bank.trim() || numBalance <= 0}>
              {isLokata ? "Dodaj lokatę" : "Dodaj konto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── EDIT SAVINGS DIALOG ──────────────────────────────────────────────── */
function EditSavingsDialog({ account }: { account: SavingsAccount }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    ...account,
    balance: formatLocaleAmount(account.balance, 0),
    ratePct: formatLocaleAmount(account.ratePct, 2),
  });

  useEffect(() => {
    if (open) {
      setDraft({
        ...account,
        balance: formatLocaleAmount(account.balance, 0),
        ratePct: formatLocaleAmount(account.ratePct, 2),
      });
    }
  }, [open, account]);

  const numBalance = parseLocaleAmount(draft.balance);
  const numRate = parseLocaleAmount(draft.ratePct);

  const isLokata = draft.type === "lokata";
  const gross =
    isLokata && numRate > 0 && numBalance > 0 && (draft.lokataDurationMonths ?? 0) > 0
      ? lokataGrossInterest(numBalance, numRate, draft.lokataDurationMonths!)
      : null;
  const net =
    gross !== null
      ? lokataNetInterest(numBalance, numRate, draft.lokataDurationMonths!)
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-[11px] text-muted-foreground hover:text-accent flex items-center gap-1"
          aria-label={`Edytuj: ${account.bank}`}
        >
          <Pencil className="w-3 h-3" /> Edytuj
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Edytuj konto / lokatę</DialogTitle>
          <DialogDescription>Zmień saldo lub inne parametry konta.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.bank.trim()) return;
            actions.updateSavings(account.id, {
              ...draft,
              balance: numBalance,
              ratePct: numRate,
            } as any);
            setOpen(false);
            toast.success("Zmiany zostały zapisane");
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Bank</label>
            <Input
              value={draft.bank}
              onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
              className="col-span-3 h-10"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Saldo (PLN)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.balance}
              onChange={(e) => setDraft({ ...draft, balance: e.target.value })}
              className="col-span-3 h-10 font-mono tabular-nums"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Oprocent. %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.ratePct}
              onChange={(e) => setDraft({ ...draft, ratePct: e.target.value })}
              className="col-span-3 h-10 font-mono tabular-nums"
            />
          </div>

          {isLokata && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Data otwarcia</label>
                <Input
                  type="date"
                  value={draft.lokataStartDate ?? ""}
                  onChange={(e) => setDraft({ ...draft, lokataStartDate: e.target.value })}
                  className="col-span-3 h-10"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Miesięcy</label>
                <Select
                  value={String(draft.lokataDurationMonths ?? 12)}
                  onValueChange={(v) => setDraft({ ...draft, lokataDurationMonths: parseInt(v) })}
                >
                  <SelectTrigger className="col-span-3 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 6, 9, 12, 18, 24, 36].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} {m === 1 ? "miesiąc" : m < 5 ? "miesiące" : "miesięcy"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {isLokata && gross !== null && net !== null && (
            <div className="col-span-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Odsetki brutto:</span>
                <span className="font-mono text-amber-600">+{formatPLN(gross)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-emerald-500/20 pt-1.5 mt-1">
                <span>Do wypłaty netto:</span>
                <span className="font-mono text-emerald-600">
                  {formatPLN(numBalance + net)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={!draft.bank.trim()}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
