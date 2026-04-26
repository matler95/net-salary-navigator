import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState } from "@/lib/store";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import {
  convertToPLN,
  formatCurrencyAmount,
  type InvestmentCurrency,
  useDailyFxRates,
} from "@/lib/fx";
import { getInvestmentCurrentValue, useDailyTickerPrices, searchTickers, type TickerSearchResult } from "@/lib/market";
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
  const total = investments.reduce(
    (s, i) => s + convertToPLN(getInvestmentCurrentValue(i, tickerPrices), i.currency, rates),
    0,
  );



  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">Inwestycje</h2>
          <AddInvestmentDialog />
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Łącznie {formatPLN(total)}
            {fxLoading || tickerLoading ? " · kursy aktualizowane..." : ""}
          </p>
          {!!rates.asOf && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground mt-1">
              Kursy FX z: {rates.asOf}
            </span>
          )}
          {!!tickerPrices.asOf && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground mt-1 ml-1">
              Ticker z: {tickerPrices.asOf}
            </span>
          )}
        </div>
      </div>



      {investments.length > 0 && (
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
                        {(["PLN", "EUR", "USD"] as InvestmentCurrency[]).map((c) => (
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
                            i.currency,
                            rates,
                          ) /
                            total) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                    <div className="text-[11px]">
                      {formatCurrencyAmount(getInvestmentCurrentValue(i, tickerPrices), i.currency)}{" "}
                      (
                      {formatPLN2(
                        convertToPLN(getInvestmentCurrentValue(i, tickerPrices), i.currency, rates),
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
        Kursy walut: NBP, odświeżane maksymalnie raz dziennie. Ticker: dzienny close, cache dobowy. Moduł inwestycji odświeżony w ramach rewizji interfejsu (UX/UI).
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
