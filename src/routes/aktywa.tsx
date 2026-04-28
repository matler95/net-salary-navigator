import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState, type SavingsAccount } from "@/lib/store";
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
import {
  Plus,
  Trash2,
  ChevronDown,
  PlusCircle,
  Loader2,
  Search,
  Check,
  TrendingUp,
  Clock,
  Wallet,
  BarChart3,
  Pencil,
} from "lucide-react";
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
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { toast } from "sonner";

export const Route = createFileRoute("/aktywa")({
  head: () => ({
    meta: [
      { title: "Aktywa & długi — Płaca.netto" },
      {
        name: "description",
        content:
          "Inwestycje, kredyty (rata równa) i mieszkania na wynajem z P&L i ryczałtem 8.5%/12.5%.",
      },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Aktywa, długi i wynajem
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          Co masz <span className="italic text-accent">i co jest twoje</span>
        </h1>
        <div className="flex flex-wrap gap-2 mt-4 text-sm sticky top-0 z-10 bg-background/80 backdrop-blur-md py-2 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <button onClick={() => scrollTo('oszczednosci')} className="bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">Oszczędności</button>
          <button onClick={() => scrollTo('inwestycje')} className="bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">Inwestycje</button>
          <button onClick={() => scrollTo('kredyty')} className="bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">Kredyty</button>
          <button onClick={() => scrollTo('wynajem')} className="bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">Nieruchomości</button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Aktywa razem" value={formatPLN(totalAssets)} />
        <StatCard label="Zobowiązania" value={formatPLN(totalLoans)} tone="destructive" />
        <StatCard label="Majątek netto" value={formatPLN(netWorth)} tone={netWorth >= 0 ? "success" : "destructive"} />
        <StatCard 
          label={rentalNet >= 0 ? "Zysk z wynajmu" : "Strata z wynajmu"} 
          value={formatPLN(rentalNet)} 
          tone={rentalNet > 0 ? "success" : "default"} 
        />
      </div>

      <div id="oszczednosci" className="scroll-mt-6"><SavingsSection /></div>
      <div id="inwestycje" className="scroll-mt-6"><InvestmentsSection /></div>
      <div id="kredyty" className="scroll-mt-6"><LoansSection /></div>
      <div id="wynajem" className="scroll-mt-6"><RentalsSection /></div>
    </main>
  );
}

/* ─── PALETTE ─────────────────────────────────────────────────────────── */
const CHART_COLORS = [
  "oklch(0.62 0.21 27)",
  "oklch(0.62 0.13 145)",
  "oklch(0.55 0.1 250)",
  "oklch(0.72 0.15 70)",
  "oklch(0.6 0.14 300)",
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
    isDue: isPassed && !paymentAlreadyMadeThisMonth,
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

  const investmentValues = investments.map((i) => ({
    ...i,
    valuePLN: convertToPLN(getInvestmentCurrentValue(i, tickerPrices), effectiveCurrency(i), rates),
  }));

  const total = investmentValues.reduce((s, i) => s + i.valuePLN, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Inwestycje</h2>
          <AddInvestmentDialog />
        </div>
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
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              Łącznie {formatPLN(total)}
              {fxLoading || tickerLoading ? " · aktualizacja..." : ""}
            </p>
            <div className="flex gap-1 justify-end mt-0.5">
              {!!rates.asOf && (
                <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Kursy FX z: {rates.asOf}
                </span>
              )}
              {!!tickerPrices.asOf && (
                <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Ticker z: {tickerPrices.asOf}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium">Typ</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Ticker</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Waluta</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Wolumen</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">% portfela</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {investments.map((i) => (
                <tr key={i.id} className="border-t border-border group">
                  <td className="px-4 py-2">
                    <Input
                      value={i.label}
                      onChange={(e) => actions.updateInvestment(i.id, { label: e.target.value })}
                      className="h-10 bg-transparent border-0 px-1 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell text-muted-foreground">{i.type}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">
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
                  <td className="px-4 py-2 hidden sm:table-cell">
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
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                    {total > 0
                      ? (
                          (convertToPLN(
                            getInvestmentCurrentValue(i, tickerPrices),
                            effectiveCurrency(i),
                            rates,
                          ) /
                            total) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                    <div className="text-[11px]">
                      {formatCurrencyAmount(
                        getInvestmentCurrentValue(i, tickerPrices),
                        effectiveCurrency(i),
                      )}{" "}
                      (
                      {formatPLN2(
                        convertToPLN(
                          getInvestmentCurrentValue(i, tickerPrices),
                          effectiveCurrency(i),
                          rates,
                        ),
                      )}
                      )
                    </div>
                    <div className="text-[11px]">
                      wolumen: {(i.volume ?? 0).toLocaleString("pl-PL")}
                      {i.tickerPriceAtAdd && i.tickerPriceDate
                        ? ` · śr. chwila ${i.tickerPriceDate}`
                        : " · bez automatycznej wyceny"}
                    </div>
                  </td>
                  <td className="px-4 py-2 w-28">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="text-muted-foreground hover:text-destructive p-1.5"
                        aria-label={`Usuń ${i.label || i.ticker}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  // Donut chart data — top 6 + "Inne"
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
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-[var(--shadow-card)] text-xs">
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
    <div className="space-y-4">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Wartość portfela
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">{formatPLN(total)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Wpłaty / m-c
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">
            {monthlyContribTotal > 0 ? formatPLN(monthlyContribTotal) : "—"}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            Pozycji razem
          </p>
          <p className="text-2xl font-bold font-display">{investmentValues.length}</p>
          {unvalued > 0 && (
            <p className="text-[11px] text-warning-foreground mt-0.5">{unvalued} bez wyceny</p>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
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
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Donut chart + breakdowns */}
      <div className="grid lg:grid-cols-[1fr,1fr] gap-4">
        {/* Donut allocation chart */}
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] p-5">
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
          <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] p-5">
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
          <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] p-5">
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
      <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
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
                    {i.ticker?.toUpperCase() || "—"}
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
                {/* Value */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-semibold tabular-nums">
                    {i.valuePLN > 0 ? (
                      formatPLN(i.valuePLN)
                    ) : (
                      <span className="text-muted-foreground text-xs">bez wyceny</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</p>
                </div>
                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                    className="text-muted-foreground hover:text-destructive p-1"
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
  const [open, setOpen] = useState(false);
  const EMPTY = { ticker: "", name: "", currency: "EUR" as InvestmentCurrency, volume: 0 };
  const [draft, setDraft] = useState(EMPTY);
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
    setQuery("");
    setResults([]);
    setDropOpen(false);
    setSearching(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shadow-sm">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Dodaj inwestycję
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
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
            if (!ticker || draft.volume <= 0) return;
            actions.addInvestment({
              label: draft.name || ticker,
              type: "ETF",
              ticker: ticker.toLowerCase(),
              currency: draft.currency,
              volume: draft.volume,
              value: 0,
              tickerPriceAtAdd: 0,
              tickerPriceDate: "",
              monthlyContribution: 0,
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

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Waluta</label>
            <Select
              value={draft.currency}
              onValueChange={(v: any) => setDraft({ ...draft, currency: v })}
            >
              <SelectTrigger className="col-span-3 h-10">
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

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Wolumen</label>
            <Input
              type="text"
              inputMode="decimal"
              value={formatLocaleAmount(draft.volume, 4)}
              onChange={(e) => setDraft({ ...draft, volume: parseLocaleAmount(e.target.value) })}
              placeholder="np. 10"
              className="col-span-3 font-mono tabular-nums h-10"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!draft.ticker.trim() || draft.volume <= 0}>
              Dodaj do portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BuyMoreDialog({ investment, currentPrice }: { investment: any; currentPrice?: number }) {
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
      <DialogContent className="sm:max-w-[425px]">
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
            actions.updateInvestment(investment.id, {
              volume: newTotalVol,
              tickerPriceAtAdd: newAvgPrice,
              tickerPriceDate: new Date().toISOString().slice(0, 10),
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
      (l.monthlyOverpayment ?? 0),
    0,
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Kredyty</h2>
          <AddLoanDialog />
        </div>
        <p className="text-sm text-muted-foreground">
          Łącznie {formatPLN(totalDebt)} · raty {formatPLN(totalPmt)}/m-c (z nadpłatą)
        </p>
      </div>

      {loans.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border">
          Brak kredytów.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
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
  };
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const overpay = loan.monthlyOverpayment ?? 0;
  const paymentInfo = getPaymentDueInfo(loan);

  const scheduleNoOverpay = useMemo(
    () => amortizationSchedule(loan.principal, loan.annualRatePct, loan.monthsRemaining, 0),
    [loan.principal, loan.annualRatePct, loan.monthsRemaining],
  );
  const schedule = useMemo(
    () => amortizationSchedule(loan.principal, loan.annualRatePct, loan.monthsRemaining, overpay),
    [loan.principal, loan.annualRatePct, loan.monthsRemaining, overpay],
  );

  const pmt = monthlyPayment(loan.principal, loan.annualRatePct, loan.monthsRemaining);
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

  // Auto-register payment when due date passes
  const hasRegisteredRef = useRef(false);
  useEffect(() => {
    if (paymentInfo.isDue && loan.principal > 0 && loan.monthsRemaining > 0 && !hasRegisteredRef.current) {
      hasRegisteredRef.current = true;
      const result = calculateLoanAfterPayment(
        loan.principal,
        loan.annualRatePct,
        loan.monthsRemaining,
        overpay,
      );
      actions.updateLoan(loan.id, {
        principal: result.principal,
        monthsRemaining: result.monthsRemaining,
        lastPaymentDate: new Date().toISOString().slice(0, 10),
      });
      toast.success(`Rata "${loan.label}" zarejestrowana`, {
        description: `Nowy kapitał: ${formatPLN(result.principal)}`
      });
    }
  }, [paymentInfo.isDue, loan.id, loan.principal, loan.annualRatePct, loan.monthsRemaining, overpay, loan.label]);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Input
          value={loan.label}
          onChange={(e) => actions.updateLoan(loan.id, { label: e.target.value })}
          className="font-display text-lg h-10 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
        />
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
          className="text-muted-foreground hover:text-destructive p-1"
          aria-label={`Usuń kredyt: ${loan.label}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Payment Status */}
      {loan.paymentDayOfMonth && (
        <div
          className={`rounded-lg p-3 mb-4 flex items-center justify-between ${
            !paymentInfo.isDue
              ? "bg-muted/40 border border-border/50"
              : "bg-success/10 border border-success/30"
          }`}
        >
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                !paymentInfo.isDue ? "text-muted-foreground" : "text-success"
              }`}
            >
              {paymentInfo.isDue ? "✓ Rata zarejestrowana" : "Następna rata"}
            </p>
            <p
              className={`text-sm font-mono mt-0.5 ${!paymentInfo.isDue ? "text-foreground" : "text-success font-bold"}`}
            >
              {paymentInfo.nextDate}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
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
        <Field label="Nadpłata / m-c">
          <LocalNumInput
            value={overpay}
            onChange={(v) => actions.updateLoan(loan.id, { monthlyOverpayment: v })}
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

      <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <p className="text-xs text-muted-foreground">Rata bazowa</p>
          <p className="font-mono tabular-nums text-sm font-semibold">{formatPLN2(pmt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Odsetki razem</p>
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
  const totalCashflow = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);
  const totalValue = rentals.reduce((s, r) => s + r.marketValue, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Mieszkania na wynajem</h2>
          <AddRentalDialog />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground mt-1">
          {formatPLN(totalValue)} · {totalCashflow >= 0 ? "zysk" : "strata"} {formatPLN(totalCashflow)}/m-c
        </div>
      </div>

      {rentals.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center text-muted-foreground border border-dashed border-border">
          Brak mieszkań na wynajem.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {rentals.map((r) => {
            const cf = rentalCashflow(r);
            const yieldPct = r.marketValue > 0 ? (cf.annualCashflow / r.marketValue) * 100 : 0;
            return (
              <div
                key={r.id}
                className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Input
                    value={r.label}
                    onChange={(e) => actions.updateRental(r.id, { label: e.target.value })}
                    className="font-display text-lg h-10 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
                  />
                  <button
                    onClick={() => {
                      const copy = { ...r };
                      actions.removeRental(r.id);
                      toast(`Usunięto wynajem: ${r.label}`, {
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
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label={`Usuń wynajem: ${r.label}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Czynsz / m-c">
                    <LocalNumInput
                      value={r.monthlyRent}
                      onChange={(v) => actions.updateRental(r.id, { monthlyRent: v })}
                      className="h-10 font-mono tabular-nums"
                      decimals={0}
                    />
                  </Field>
                  <Field label="Koszty / m-c">
                    <LocalNumInput
                      value={r.monthlyCosts}
                      onChange={(v) => actions.updateRental(r.id, { monthlyCosts: v })}
                      className="h-10 font-mono tabular-nums"
                      decimals={0}
                    />
                  </Field>
                  <Field label="Rata kredytu / m-c">
                    <LocalNumInput
                      value={r.monthlyMortgage}
                      onChange={(v) => actions.updateRental(r.id, { monthlyMortgage: v })}
                      className="h-10 font-mono tabular-nums"
                      decimals={0}
                    />
                  </Field>
                  <Field label="Wartość">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={r.marketValue}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          marketValue: parseLocaleAmount(e.target.value),
                        })
                      }
                      className="h-10 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Pustostan %">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={r.vacancyRatePct}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          vacancyRatePct: parseLocaleAmount(e.target.value),
                        })
                      }
                      className="h-10 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Podatek %">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={r.taxRatePct}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          taxRatePct: parseLocaleAmount(e.target.value),
                        })
                      }
                      className="h-10 font-mono tabular-nums"
                    />
                  </Field>
                </div>

                <div
                  className={`rounded-xl p-3 grid grid-cols-3 gap-2 text-center ${
                    cf.cashflow >= 0
                      ? "bg-success/10 border border-success/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">{cf.cashflow >= 0 ? "Zysk" : "Strata"} / m-c</p>
                    <p className={`font-mono tabular-nums text-sm font-semibold ${cf.cashflow >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatPLN2(cf.cashflow)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rocznie</p>
                    <p className="font-mono tabular-nums text-sm font-semibold">
                      {formatPLN(cf.annualCashflow)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Yield brutto</p>
                    <p className="font-mono tabular-nums text-sm font-semibold">
                      {yieldPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
  decimals?: number;
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
    paymentDayOfMonth: undefined as number | undefined,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shadow-sm group">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Dodaj kredyt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
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
              paymentDayOfMonth: undefined,
            });
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
            <label className="text-right text-sm font-medium text-muted-foreground">
              Nadpłata
            </label>
            <LocalNumInput
              value={draft.monthlyOverpayment}
              onChange={(v) => setDraft({ ...draft, monthlyOverpayment: v })}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
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
            <Button type="submit">Dodaj kredyt</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRentalDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    monthlyRent: 0,
    monthlyCosts: 0,
    monthlyMortgage: 0,
    vacancyRatePct: 5,
    taxRatePct: 8.5,
    marketValue: 0,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shadow-sm group">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Dodaj nieruchomość
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dodaj wynajem / nieruchomość</DialogTitle>
          <DialogDescription>Wprowadź dane lokalu na wynajem i oblicz cashflow.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.label.trim()) return;
            actions.addRental(draft);
            setDraft({
              label: "",
              monthlyRent: 0,
              monthlyCosts: 0,
              monthlyMortgage: 0,
              vacancyRatePct: 5,
              taxRatePct: 8.5,
              marketValue: 0,
            });
            setOpen(false);
          }}
        >
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
            <label className="text-right text-sm font-medium text-success">Czynsz</label>
            <LocalNumInput
              value={draft.monthlyRent}
              onChange={(v) => setDraft({ ...draft, monthlyRent: v })}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Wartość</label>
            <LocalNumInput
              value={draft.marketValue}
              onChange={(v) => setDraft({ ...draft, marketValue: v })}
              className="col-span-3 font-mono tabular-nums h-10"
              decimals={0}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Dodaj nieruchomość</Button>
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
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Oszczędności</h2>
          <AddSavingsDialog />
        </div>
        <div className="flex items-center gap-3">
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
          {savings.length > 0 && (
            <p className="text-sm text-muted-foreground">Łącznie {formatPLN(totalBalance)}</p>
          )}
        </div>
      </div>

      {savings.length === 0 && (
        <p className="text-sm text-muted-foreground">Brak kont. Dodaj konto bankowe lub lokatę.</p>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Saldo łączne
          </p>
          <p className="text-2xl font-bold tabular-nums font-display">{formatPLN(totalBalance)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Po odsetkach
          </p>
          <p className="text-2xl font-bold tabular-nums font-display text-emerald-500">
            {formatPLN(totalWithInterest)}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
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
        <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-card)]">
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
          <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
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
                            className={`h-full rounded-full transition-all ${
                              isExpired
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
                    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
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
          <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
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
                            className={`h-full rounded-full ${
                              ratePct >= 90
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
                    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
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
      <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
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
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${
                      a.type === "lokata"
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
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] p-4 space-y-3 relative group">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{account.bank}</p>
          <p className="text-[11px] text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.type]}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="text-muted-foreground hover:text-destructive p-1"
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
        <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs border border-border/50">
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
        <Button variant="outline" size="sm" className="h-8 shadow-sm">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Dodaj konto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Dodaj konto / lokatę</DialogTitle>
          <DialogDescription>
            {isLokata
              ? "Wprowadź dane lokaty — kalkulator wyliczy odsetki netto po podatku Belki."
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
      <DialogContent className="sm:max-w-[440px]">
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
