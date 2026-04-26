import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState, type SavingsAccount } from "@/lib/store";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import {
  convertToPLN,
  formatCurrencyAmount,
  type InvestmentCurrency,
  useDailyFxRates,
} from "@/lib/fx";
import { getInvestmentCurrentValue, useDailyTickerPrices, searchTickers, type TickerSearchResult, getTickerCurrency } from "@/lib/market";
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
import { Plus, Trash2, ChevronDown, PlusCircle, Loader2, Search, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Aktywa, długi i wynajem
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          Co masz <span className="italic text-accent">i co jest twoje</span>
        </h1>
      </header>

      <SavingsSection />
      <InvestmentsSection />
      <LoansSection />
      <RentalsSection />
    </main>
  );
}

/* INVESTMENTS */
function InvestmentsSection() {
  const investments = useAppState((s) => s.investments);
  const { rates, loading: fxLoading } = useDailyFxRates();
  const { prices: tickerPrices, loading: tickerLoading } = useDailyTickerPrices(
    investments.map((i) => i.ticker ?? ""),
  );
  const [view, setView] = useState<"list" | "summary">("list");

  const effectiveCurrency = (i: typeof investments[number]) => {
    const ticker = (i.ticker ?? "").trim().toLowerCase();
    const yahooCur = getTickerCurrency(ticker, tickerPrices) as InvestmentCurrency | undefined;
    return (yahooCur && ["PLN", "EUR", "USD", "GBP"].includes(yahooCur) ? yahooCur : i.currency);
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
              >Lista</button>
              <button
                onClick={() => setView("summary")}
                className={`px-2.5 py-1 transition-colors ${view === "summary" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >Podsumowanie</button>
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

      {view === "summary" && investments.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
          {/* Top row: total + largest position */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Wartość portfela</p>
              <p className="text-2xl font-bold tabular-nums">{formatPLN(total)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pozycji</p>
              <p className="text-2xl font-bold">{investments.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Największa pozycja</p>
              {(() => {
                const top = [...investmentValues].sort((a, b) => b.valuePLN - a.valuePLN)[0];
                return top ? (
                  <p className="text-base font-semibold truncate">{top.label} <span className="text-muted-foreground text-sm">({total > 0 ? ((top.valuePLN / total) * 100).toFixed(1) : 0}%)</span></p>
                ) : null;
              })()}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Bez wyceny</p>
              <p className="text-base font-semibold">{investmentValues.filter(i => i.valuePLN === 0).length} pozycji</p>
            </div>
          </div>

          {/* Allocation bar */}
          {total > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Alokacja</p>
              <div className="flex rounded-full overflow-hidden h-3 gap-px">
                {[...investmentValues]
                  .filter(i => i.valuePLN > 0)
                  .sort((a, b) => b.valuePLN - a.valuePLN)
                  .map((i, idx) => {
                    const colors = ["bg-accent","bg-emerald-500","bg-amber-500","bg-sky-500","bg-violet-500","bg-rose-500","bg-teal-500","bg-orange-400"];
                    return (
                      <div
                        key={i.id}
                        style={{ width: `${(i.valuePLN / total) * 100}%` }}
                        className={`${colors[idx % colors.length]} transition-all`}
                        title={`${i.label}: ${formatPLN(i.valuePLN)}`}
                      />
                    );
                  })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[...investmentValues]
                  .filter(i => i.valuePLN > 0)
                  .sort((a, b) => b.valuePLN - a.valuePLN)
                  .slice(0, 6)
                  .map((i, idx) => {
                    const colors = ["bg-accent","bg-emerald-500","bg-amber-500","bg-sky-500","bg-violet-500","bg-rose-500"];
                    return (
                      <span key={i.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                        {i.label} · {((i.valuePLN / total) * 100).toFixed(1)}%
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Per-position rows */}
          <div className="divide-y divide-border">
            {[...investmentValues].sort((a, b) => b.valuePLN - a.valuePLN).map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{i.label}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{i.ticker?.toUpperCase()} · {effectiveCurrency(i)} · {(i.volume ?? 0).toLocaleString("pl-PL")} szt.</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-mono font-semibold text-sm">{formatPLN(i.valuePLN)}</p>
                  <p className="text-[11px] text-muted-foreground">{total > 0 ? ((i.valuePLN / total) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "list" && investments.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium">Typ</th>
                <th className="text-left px-4 py-3 font-medium">Ticker</th>
                <th className="text-left px-4 py-3 font-medium">Waluta</th>
                <th className="text-right px-4 py-3 font-medium">Wolumen</th>
                <th className="text-right px-4 py-3 font-medium">% portfela</th>
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
                      className="h-9 bg-transparent border-0 px-1 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{i.type}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={i.ticker ?? ""}
                      onChange={(e) =>
                        actions.updateInvestment(i.id, {
                          ticker: e.target.value.trim().toLowerCase(),
                        })
                      }
                      placeholder="np. vwce.de"
                      className="h-9 w-[122px] font-mono text-xs bg-transparent border-0 px-1 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={i.currency}
                      onValueChange={(v) =>
                        actions.updateInvestment(i.id, { currency: v as InvestmentCurrency })
                      }
                    >
                      <SelectTrigger className="h-9 w-[88px] bg-transparent border-0 hover:bg-muted/50 shadow-none text-xs">
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
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      step="0.0001"
                      value={i.volume ?? ""}
                      onChange={(e) =>
                        actions.updateInvestment(i.id, { volume: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-right font-mono tabular-nums bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
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
                      {formatCurrencyAmount(getInvestmentCurrentValue(i, tickerPrices), effectiveCurrency(i))}{" "}
                      (
                      {formatPLN2(
                        convertToPLN(getInvestmentCurrentValue(i, tickerPrices), effectiveCurrency(i), rates),
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
                        onClick={() => actions.removeInvestment(i.id)}
                        className="text-muted-foreground hover:text-destructive p-1.5"
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
        Kursy walut: NBP (PLN/EUR/USD/GBP), odświeżane raz dziennie. Ticker: kurs bieżący via Yahoo Finance, cache dobowy.
      </p>
    </section>
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
    if (!value.trim() || value.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchTickers(value);
      setResults(found);
      setSearching(false);
    }, 350);
  }, []);

  const handleSelect = (result: TickerSearchResult) => {
    // Map Yahoo currency to our supported currencies
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset(); }}>
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
          {/* Ticker search */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Instrument</label>
            <Popover open={dropOpen && (results.length > 0 || searching)} onOpenChange={setDropOpen}>
              <PopoverAnchor asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQuery(e.target.value)}
                    onFocus={() => { if (results.length > 0) setDropOpen(true); }}
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
                          <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">{r.type}</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{r.exchange} · {r.currency}</p>
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

          {/* Currency */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Waluta</label>
            <Select value={draft.currency} onValueChange={(v: any) => setDraft({ ...draft, currency: v })}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["PLN", "EUR", "USD"] as InvestmentCurrency[]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volume */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Wolumen</label>
            <Input
              type="number"
              value={draft.volume || ""}
              onChange={(e) => setDraft({ ...draft, volume: parseFloat(e.target.value) || 0 })}
              step="0.0001"
              placeholder="np. 10"
              className="col-span-3 font-mono tabular-nums"
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



function BuyMoreDialog({ investment, currentPrice }: { investment: any, currentPrice?: number }) {
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
          <DialogDescription>Dodaj wolumen do istniejącej pozycji i przelicz średnią cenę.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            const additionalVol = parseFloat(addedVolume) || 0;
            const newPrice = parseFloat(buyPrice) || 0;

            if (additionalVol <= 0) return;

            const oldVol = investment.volume || 0;
            const oldAvgPrice = investment.tickerPriceAtAdd || newPrice;
            const newTotalVol = oldVol + additionalVol;

            let newAvgPrice = newPrice;
            if (newTotalVol > 0 && oldAvgPrice > 0 && newPrice > 0) {
              newAvgPrice = (oldVol * oldAvgPrice + additionalVol * newPrice) / newTotalVol;
            }

            actions.updateInvestment(investment.id, {
              volume: newTotalVol,
              tickerPriceAtAdd: newAvgPrice,
              tickerPriceDate: new Date().toISOString().slice(0, 10),
            });

            setOpen(false);
            setAddedVolume("");
            // keep buyPrice as is, or updated
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm">Sztuki</label>
            <Input
              type="number"
              step="0.0001"
              value={addedVolume}
              onChange={(e) => setAddedVolume(e.target.value)}
              className="col-span-3 font-mono"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm">Cena / szt.</label>
            <Input
              type="number"
              step="0.0001"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="col-span-3 font-mono"
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



      {loans.length > 0 && (
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
  };
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const overpay = loan.monthlyOverpayment ?? 0;

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

  // Sample chart down to ~60 points
  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(schedule.length / 60));
    return schedule
      .filter((_, i) => i % step === 0 || i === schedule.length - 1)
      .map((r) => ({ month: r.month, balance: r.balance }));
  }, [schedule]);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Input
          value={loan.label}
          onChange={(e) => actions.updateLoan(loan.id, { label: e.target.value })}
          className="font-display text-lg h-9 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
        />
        <button
          onClick={() => actions.removeLoan(loan.id)}
          className="text-muted-foreground hover:text-destructive p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Kapitał">
          <Input
            type="number"
            value={loan.principal}
            onChange={(e) =>
              actions.updateLoan(loan.id, { principal: parseFloat(e.target.value) || 0 })
            }
            className="h-9 font-mono tabular-nums"
          />
        </Field>
        <Field label="Oproc. %">
          <Input
            type="number"
            step="0.1"
            value={loan.annualRatePct}
            onChange={(e) =>
              actions.updateLoan(loan.id, { annualRatePct: parseFloat(e.target.value) || 0 })
            }
            className="h-9 font-mono tabular-nums"
          />
        </Field>
        <Field label="Pozostałe m-ce">
          <Input
            type="number"
            value={loan.monthsRemaining}
            onChange={(e) =>
              actions.updateLoan(loan.id, { monthsRemaining: parseInt(e.target.value) || 0 })
            }
            className="h-9 font-mono tabular-nums"
          />
        </Field>
        <Field label="Nadpłata / m-c">
          <Input
            type="number"
            value={overpay || ""}
            onChange={(e) =>
              actions.updateLoan(loan.id, { monthlyOverpayment: parseFloat(e.target.value) || 0 })
            }
            className="h-9 font-mono tabular-nums"
          />
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
        <p className="text-sm text-muted-foreground">
          {rentals.length} {rentals.length === 1 ? "mieszkanie" : "mieszkań"} · wartość{" "}
          {formatPLN(totalValue)} · cashflow {formatPLN(totalCashflow)}/m-c
        </p>
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
                    className="font-display text-lg h-9 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
                  />
                  <button
                    onClick={() => actions.removeRental(r.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Czynsz / m-c">
                    <Input
                      type="number"
                      value={r.monthlyRent}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          monthlyRent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Koszty / m-c">
                    <Input
                      type="number"
                      value={r.monthlyCosts}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          monthlyCosts: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Rata kredytu">
                    <Input
                      type="number"
                      value={r.monthlyMortgage}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          monthlyMortgage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Wartość rynkowa">
                    <Input
                      type="number"
                      value={r.marketValue}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          marketValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Pustostany %">
                    <Input
                      type="number"
                      value={r.vacancyRatePct}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          vacancyRatePct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Podatek % (8.5/12.5)">
                    <Input
                      type="number"
                      step="0.5"
                      value={r.taxRatePct}
                      onChange={(e) =>
                        actions.updateRental(r.id, {
                          taxRatePct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
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
                    <p className="text-xs text-muted-foreground">Cashflow / m-c</p>
                    <p
                      className={`font-mono tabular-nums text-sm font-semibold ${cf.cashflow >= 0 ? "text-success" : "text-destructive"}`}
                    >
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

function isTickerFormatValid(value: string): boolean {
  return /^[a-z0-9._-]+\.[a-z]{2,}$/.test(value.trim().toLowerCase());
}

function AddLoanDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    label: "",
    principal: 0,
    annualRatePct: 7.5,
    monthsRemaining: 240,
    monthlyOverpayment: 0,
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
          <DialogDescription>Wprowadź dane kredytu, aby wyliczyć ratę i harmonogram.</DialogDescription>
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
            <label className="text-right text-sm font-medium">Kapitał do spłaty</label>
            <Input
              type="number"
              value={draft.principal || ""}
              onChange={(e) => setDraft({ ...draft, principal: parseFloat(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Pozostałe m-ce</label>
            <Input
              type="number"
              value={draft.monthsRemaining || ""}
              onChange={(e) => setDraft({ ...draft, monthsRemaining: parseInt(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Oproc. % rocznie</label>
            <Input
              type="number"
              step="0.1"
              value={draft.annualRatePct || ""}
              onChange={(e) => setDraft({ ...draft, annualRatePct: parseFloat(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium text-muted-foreground">Nadpłata / m-c</label>
            <Input
              type="number"
              value={draft.monthlyOverpayment || ""}
              onChange={(e) => setDraft({ ...draft, monthlyOverpayment: parseFloat(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
            />
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
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium text-success">Czynsz</label>
            <Input
              type="number"
              value={draft.monthlyRent || ""}
              onChange={(e) => setDraft({ ...draft, monthlyRent: parseFloat(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Wartość rynkowa</label>
            <Input
              type="number"
              value={draft.marketValue || ""}
              onChange={(e) => setDraft({ ...draft, marketValue: parseFloat(e.target.value) || 0 })}
              className="col-span-3 font-mono tabular-nums"
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
              >Lista</button>
              <button
                onClick={() => setView("summary")}
                className={`px-2.5 py-1 transition-colors ${view === "summary" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >Podsumowanie</button>
            </div>
          )}
          {savings.length > 0 && (
            <p className="text-sm text-muted-foreground">Łącznie {formatPLN(totalBalance)}</p>
          )}
        </div>
      </div>

      {savings.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Brak kont. Dodaj konto bankowe lub lokatę.
        </p>
      )}

      {/* SUMMARY VIEW */}
      {view === "summary" && savings.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo łączne</p>
              <p className="text-2xl font-bold tabular-nums">{formatPLN(totalBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Po odsetkach</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-500">{formatPLN(totalWithInterest)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Zysk netto</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-500">+{formatPLN(totalWithInterest - totalBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Kont</p>
              <p className="text-2xl font-bold">{savings.length}</p>
            </div>
          </div>

          {/* Per-account rows */}
          <div className="divide-y divide-border">
            {savings.map((a) => {
              const isLokata = a.type === "lokata";
              const net = isLokata && a.ratePct > 0 && (a.lokataDurationMonths ?? 0) > 0
                ? lokataNetInterest(a.balance, a.ratePct, a.lokataDurationMonths!)
                : null;
              const maturity = isLokata && a.lokataStartDate && a.lokataDurationMonths
                ? lokataMaturityDate(a.lokataStartDate, a.lokataDurationMonths)
                : null;
              return (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{a.bank}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ACCOUNT_TYPE_LABEL[a.type]}
                      {a.ratePct > 0 ? ` · ${a.ratePct.toFixed(2)}% p.a.` : ""}
                      {maturity ? ` · zapadalność: ${maturity}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono font-semibold text-sm">{formatPLN(a.balance)}</p>
                    {net !== null && (
                      <p className="text-[11px] text-emerald-500 font-mono">+{formatPLN(net)} netto</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

const ACCOUNT_TYPE_LABEL: Record<SavingsAccount["type"], string> = {
  "zwykłe": "Konto zwykłe",
  "oszczędnościowe": "Konto oszczędnościowe",
  "lokata": "Lokata terminowa",
};

function SavingsCard({ account }: { account: SavingsAccount }) {
  const isLokata = account.type === "lokata";
  const gross =
    isLokata && account.ratePct > 0 && account.balance > 0 && (account.lokataDurationMonths ?? 0) > 0
      ? lokataGrossInterest(account.balance, account.ratePct, account.lokataDurationMonths!)
      : null;
  const net = gross !== null
    ? lokataNetInterest(account.balance, account.ratePct, account.lokataDurationMonths!)
    : null;
  const maturity =
    isLokata && account.lokataStartDate && account.lokataDurationMonths
      ? lokataMaturityDate(account.lokataStartDate, account.lokataDurationMonths)
      : null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 relative group">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-base">{account.bank}</p>
          <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.type]}</p>
        </div>
        <button
          onClick={() => actions.removeSavings(account.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1"
          title="Usuń"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{formatPLN(account.balance)}</span>
        {account.ratePct > 0 && (
          <span className="text-sm text-emerald-500 font-medium">
            {account.ratePct.toFixed(2)}% p.a.
          </span>
        )}
      </div>

      {/* Lokata summary */}
      {isLokata && gross !== null && net !== null && (
        <div className="rounded-lg bg-muted/60 p-3 space-y-1.5 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
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
          <div className="flex justify-between font-semibold border-t pt-2 mt-1">
            <span>Wypłata netto</span>
            <span className="font-mono text-emerald-500">{formatPLN(account.balance + net)}</span>
          </div>
          {maturity && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Zapadalność:{" "}
              <span className="font-medium text-foreground">{maturity}</span>
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
  const EMPTY: Omit<SavingsAccount, "id"> = {
    bank: "",
    type: "oszczędnościowe",
    balance: 0,
    ratePct: 0,
    lokataStartDate: new Date().toISOString().slice(0, 10),
    lokataDurationMonths: 12,
    lokataCapitalization: "na końcu",
  };
  const [draft, setDraft] = useState(EMPTY);

  const isLokata = draft.type === "lokata";
  const gross =
    isLokata && draft.ratePct > 0 && draft.balance > 0 && (draft.lokataDurationMonths ?? 0) > 0
      ? lokataGrossInterest(draft.balance, draft.ratePct, draft.lokataDurationMonths!)
      : null;
  const net = gross !== null
    ? lokataNetInterest(draft.balance, draft.ratePct, draft.lokataDurationMonths!)
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDraft(EMPTY); }}>
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
            if (!draft.bank.trim() || draft.balance <= 0) return;
            actions.addSavings({ ...draft });
            setDraft(EMPTY);
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Bank</label>
            <Input
              value={draft.bank}
              onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
              placeholder="np. PKO BP, mBank, Revolut"
              className="col-span-3"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Typ konta</label>
            <Select value={draft.type} onValueChange={(v: any) => setDraft({ ...draft, type: v })}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
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
              type="number"
              value={draft.balance || ""}
              onChange={(e) => setDraft({ ...draft, balance: parseFloat(e.target.value) || 0 })}
              step="0.01"
              placeholder="np. 10 000"
              className="col-span-3 font-mono tabular-nums"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Oprocentowanie %</label>
            <Input
              type="number"
              value={draft.ratePct || ""}
              onChange={(e) => setDraft({ ...draft, ratePct: parseFloat(e.target.value) || 0 })}
              step="0.01"
              placeholder="np. 6.50"
              className="col-span-3 font-mono tabular-nums"
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
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Czas trwania</label>
                <Select
                  value={String(draft.lokataDurationMonths ?? 12)}
                  onValueChange={(v) => setDraft({ ...draft, lokataDurationMonths: parseInt(v) })}
                >
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="miesięczna">Miesięczna</SelectItem>
                    <SelectItem value="kwartalna">Kwartalna</SelectItem>
                    <SelectItem value="roczna">Roczna</SelectItem>
                    <SelectItem value="na końcu">Na końcu okresu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Live ROI preview */}
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
                    <span className="font-mono text-emerald-500">{formatPLN(draft.balance + net)}</span>
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
            <Button type="submit" disabled={!draft.bank.trim() || draft.balance <= 0}>
              {isLokata ? "Dodaj lokatę" : "Dodaj konto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
