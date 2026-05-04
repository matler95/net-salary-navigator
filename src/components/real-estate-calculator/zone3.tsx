import { useRealEstate } from "./context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatPLN, formatPLN2, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine
} from "recharts";
import { calculateRealEstate, amortizationSchedule, amortizationScheduleDecreasing, calcRequiredOverpayment } from "@/lib/finance";
import { actions } from "@/lib/store";
import { Info, Save } from "lucide-react";
import { ObligacjeTab } from "./zone4";

export function InsightPanel() {
  return (
    <Tabs defaultValue="flow" className="space-y-6">
      <TabsList className="w-full flex sm:w-auto overflow-x-auto bg-transparent p-0 border-b border-border/40 rounded-none h-auto justify-start">
        <TabsTrigger value="flow" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent">
          Przepływ Pieniędzy
        </TabsTrigger>
        <TabsTrigger value="cashflow" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent">
          Zysk miesięczny
        </TabsTrigger>
        <TabsTrigger value="longterm" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent">
          Zysk w czasie
        </TabsTrigger>
        <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent">
          Ryzyko i błędy
        </TabsTrigger>
        <TabsTrigger value="budget" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent">
          Mój portfel
        </TabsTrigger>
        <TabsTrigger value="obligacje" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 bg-transparent whitespace-nowrap">
          vs. Obligacje
        </TabsTrigger>
      </TabsList>

      <TabsContent value="flow" className="animate-fade-up">
        <FlowTab />
      </TabsContent>
      <TabsContent value="cashflow" className="animate-fade-up">
        <CashflowTab />
      </TabsContent>
      <TabsContent value="longterm" className="animate-fade-up">
        <LongtermTab />
      </TabsContent>
      <TabsContent value="risk" className="animate-fade-up">
        <RiskTab />
      </TabsContent>
      <TabsContent value="budget" className="animate-fade-up">
        <BudgetTab />
      </TabsContent>
      <TabsContent value="obligacje" className="animate-fade-up">
        <ObligacjeTab />
      </TabsContent>
    </Tabs>
  );
}

// ─── CashflowTab ─────────────────────────────────────────────────────────────
// Shows a monthly steady-state waterfall breakdown.
// "Steady-state" = one normal month at full rental occupancy, no vacancy months averaged in.
// r.monthlyCashflow (from calculateRealEstate) = year-1 average including vacancy months.
// These two numbers differ when vacancyMonths > 0 — both are shown clearly.

function CashflowTab() {
  const { s, r, minRent, rentMargin, rentMarginPct, steadyCashflow } = useRealEstate();

  const effectiveOverpayment = s.tsoverpaymentEnabled
    ? (s.overpaymentMonthly ?? calcRequiredOverpayment(s))
    : 0;

  const vacancyMonths = Math.max(0, (s.renovationMonths || 0) + (s.tenantSearchMonths || 0));
  const hasVacancy = vacancyMonths > 0;
  // Used in waterfall chart — tax on a normal steady-state month at full occupancy
  const monthlyTax = s.monthlyRent * (s.taxRatePct / 100);

  // Year-1 average interest from amortization schedule (first 12 months)
  const loanAmount =
    Math.max(0, s.purchasePrice * (1 - s.downPaymentPct / 100)) +
    (s.renovationCost * (s.renovationFinancedPct || 0)) / 100;
  const months = Math.max(1, s.mortgageYears * 12);
  const scheduleFirstYear =
    s.mortgageType === "equal"
      ? amortizationSchedule(loanAmount, s.mortgageRatePct, months, effectiveOverpayment, "fixed").slice(0, 12)
      : amortizationScheduleDecreasing(loanAmount, s.mortgageRatePct, months, effectiveOverpayment).slice(0, 12);
  const avgMonthlyInterestYr1 =
    scheduleFirstYear.length > 0
      ? scheduleFirstYear.reduce((sum, row) => sum + row.interest, 0) / scheduleFirstYear.length
      : 0;

  // Waterfall lines for steady-state month
  const waterfallSteps: {
    label: string;
    value: number;
    tone: "accent" | "subtotal" | "muted" | "destructive" | "warning" | "info";
    hint?: string;
    subs?: { label: string; value: number }[];
  }[] = [
    { label: "Czynsz od najemcy", value: s.monthlyRent, tone: "accent" },
    { label: "Koszty stałe właściciela", value: -s.monthlyCosts, tone: "muted",
      hint: "Czynsz admin., zarządzanie, rezerwa, ubezpieczenie nieruchomości" },
    {
      label: "Rata kredytu (kapitał + odsetki)",
      value: -r.monthlyPmt,
      tone: "destructive",
      subs: [
        { label: "z czego odsetki (śr. rok 1)", value: -avgMonthlyInterestYr1 },
        { label: "kapitał (spłata długu)", value: -(r.monthlyPmt - avgMonthlyInterestYr1) },
      ]
    },
    { label: "Ubezpieczenie kredytu", value: -s.mortgageInsuranceMonthly, tone: "destructive" },
    ...(effectiveOverpayment > 0 ? [{
      label: "Nadpłata kredytu",
      value: -effectiveOverpayment,
      tone: "warning" as const,
      hint: "Skraca okres kredytu — realny wydatek, ale budujesz kapitał szybciej",
    }] : []),
    { label: `Podatek ryczałtowy (${s.taxRatePct}% od czynszu)`, value: -monthlyTax, tone: "warning" },
  ];

  const totalWidth = s.monthlyRent;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm space-y-6">
        <div>
          <h3 className="font-display text-xl mb-1">Gdzie idą pieniądze każdego miesiąca?</h3>
          <p className="text-xs text-muted-foreground">
            Zysk przy <span className="font-semibold text-foreground">pełnym wynajmie</span> — jeden normalny miesiąc bez pustostanu.
            {hasVacancy && (
              <> Rok&nbsp;1 z {vacancyMonths}&nbsp;m-cami pustostanu: <span className={cn("font-semibold", r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>{formatPLN2(r.monthlyCashflow)}/m-c średnio</span> (czynsz z {12 - vacancyMonths} m-cy rozłożony na 12).</>
            )}
          </p>
        </div>

        <div className="space-y-3">
          {waterfallSteps.map((step, i) => {
            if (step.value === 0) return null;
            const isSub = step.tone === "subtotal";
            const absVal = Math.abs(step.value);
            const pct = (absVal / totalWidth) * 100;

            return (
              <div key={i} className={cn("group flex flex-col gap-1.5", isSub && "pt-2 pb-1 border-y border-border/50")}>
                <div className="flex justify-between items-baseline cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                  <div>
                    <span className={cn("text-[11px] font-bold uppercase tracking-widest", isSub ? "text-foreground" : "text-muted-foreground")}>
                      {step.label}
                    </span>
                    {step.hint && (
                      <p className="text-[10px] text-muted-foreground italic">{step.hint}</p>
                    )}
                  </div>
                  <span className={cn(
                    "font-mono text-sm font-bold",
                    step.value < 0 ? "text-destructive" : isSub ? "text-foreground" : "text-accent"
                  )}>
                    {step.value > 0 ? "+" : ""}{formatPLN(step.value)}
                  </span>
                </div>
                {!isSub && (
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        step.tone === "accent" ? "bg-accent" :
                          step.tone === "destructive" ? "bg-destructive/60" :
                            step.tone === "warning" ? "bg-warning" :
                              step.tone === "info" ? "bg-blue-500" : "bg-muted-foreground/40"
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                )}
                {step.subs && (
                  <div className="pl-4 space-y-1 mt-1 border-l-2 border-border ml-1">
                    {step.subs.map((sub, j) => (
                      <div key={j} className="flex justify-between items-baseline text-xs text-muted-foreground opacity-70">
                        <span>{sub.label}</span>
                        <span className="font-mono">{formatPLN(sub.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4 border-t-2 border-border">
            <div className="flex justify-between items-center">
              <span className="font-display text-lg">Zysk miesięczny (pełny wynajem)</span>
              <div className="text-right">
                <p className={cn(
                  "font-display text-2xl font-bold leading-none",
                  steadyCashflow >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatPLN(steadyCashflow)}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">co miesiąc</p>
              </div>
            </div>
            {hasVacancy && Math.abs(steadyCashflow - r.monthlyCashflow) > 1 && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-warning/5 rounded-xl border border-warning/20">
                <Info className="w-4 h-4 text-warning-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Rok 1 (z {vacancyMonths} m-c pustostanu): </span>
                  <span className={cn("font-semibold", r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>{formatPLN2(r.monthlyCashflow)}/m-c</span>
                  {" "}— czynsz z {12 - vacancyMonths} m-cy podzielony na 12. Różnica: <span className="font-mono">{formatPLN2(steadyCashflow - r.monthlyCashflow)}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Suma kosztów / m-c</p>
          <p className="font-mono text-lg font-bold">
            {formatPLN(s.monthlyCosts + r.monthlyPmt + s.mortgageInsuranceMonthly + effectiveOverpayment + monthlyTax)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Wszystkie zobowiązania łącznie.</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Stawka podatku</p>
          <p className="font-mono text-lg font-bold">{s.taxRatePct.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Ryczałt od przychodu brutto.</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Próg rentowności</p>
          <p className="font-mono text-lg font-bold">{formatPLN(minRent)}</p>
          <p className={cn("text-xs mt-1 font-bold", rentMargin >= 0 ? "text-success" : "text-destructive")}>
            Zapas: {rentMargin >= 0 ? "+" : ""}{formatPLN(rentMargin)} ({rentMarginPct.toFixed(0)}%)
          </p>
          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Czynsz pokrywający ratę, koszty i podatek przy pełnym wynajmie. Nie uwzględnia pustostanu — patrz Zysk rok 1.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── LongtermTab ─────────────────────────────────────────────────────────────
function LongtermTab() {
  const { r, s } = useRealEstate();
  const breakEvenYear = r.breakEvenMonths > 0 ? Math.ceil(r.breakEvenMonths / 12) : null;
  const cfPositiveYear = r.yearly.findIndex((y) => y.cashflow > 0) + 1;
  const halfPaidYear = r.yearly.findIndex((y) => y.loanBalance <= r.loanAmount / 2) + 1;

  const milestones = [
    { year: cfPositiveYear > 0 ? cfPositiveYear : null, label: "Zaczynasz zarabiać co miesiąc" },
    { year: breakEvenYear, label: "Zwrot włożonej gotówki" },
    { year: halfPaidYear > 0 ? halfPaidYear : null, label: "Spłacasz połowę kredytu" },
    { year: s.holdingYears, label: `Zysk po sprzedaży i spłacie: ${formatPLN(r.totalReturn)}` },
  ]
    .filter((m) => m.year !== null && m.year <= s.holdingYears)
    .sort((a, b) => (a.year as number) - (b.year as number));

  const groupedMilestones = milestones.reduce((acc, curr) => {
    const existing = acc.find((m) => m.year === curr.year);
    if (existing) {
      existing.label += ` & ${curr.label}`;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as typeof milestones);

  const chartData = r.yearly.map((y) => ({ ...y, negativeLoan: -y.loanBalance }));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
        <h3 className="font-display text-xl mb-6">Wzrost majątku ({s.holdingYears} lat)</h3>

        <div className="h-64 sm:h-80 mb-6">
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0} />
                  <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.015 85)" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} unit="r" axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatPLN(Math.abs(v))} labelFormatter={(y) => `Rok ${y}`} contentStyle={{ fontSize: 12, borderRadius: 16, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, paddingBottom: 10 }} />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
              <Area type="monotone" dataKey="equity" name="Majątek własny" stroke="var(--color-success)" fill="url(#colorEquity)" strokeWidth={2} />
              <Line type="monotone" dataKey="cumulativeCashflow" name="Suma zysków" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="negativeLoan" name="Pozostały kredyt" stroke="var(--color-destructive)" fill="url(#colorDebt)" strokeWidth={2} />
              <Line type="monotone" dataKey="propertyValue" name="Wartość mieszkania" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/50">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Kamienie milowe</p>
          {groupedMilestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="bg-background border shadow-sm px-2 py-0.5 rounded-md font-mono text-xs font-bold text-accent shrink-0">Rok {m.year}</div>
              <p className="mt-0.5 font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FlowTab ─────────────────────────────────────────────────────────────────
function FlowTab() {
  const { r, s, requiredOverpayment, updateS } = useRealEstate();

  const remainingLoan = r.yearly[r.yearly.length - 1].loanBalance;
  const netFromSale = r.netFromSale;
  const saleCosts = r.saleCosts;
  const finalProfit = s.sellAtEnd ? r.totalReturn : r.totalReturnNoSale;
  const finalProfitPct = s.sellAtEnd ? r.totalReturnPct : r.totalReturnNoSalePct;

  const formatSignedPLN = (value: number) => `${value >= 0 ? "+" : ""}${formatPLN(value)}`;
  const valueToneClass = (value: number) =>
    value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-foreground";

  // Gross rent collected over holding period
  const totalGrossRent = r.yearly.reduce((sum, y) => sum + y.rent, 0);

  // Break down totalOperationalCosts (baseline, no overpayments) into components
  const totalTax = r.yearly.reduce((sum, y) => sum + (y.rent * s.taxRatePct) / 100, 0);
  const totalMonthlyCosts = s.monthlyCosts * 12 * s.holdingYears;
  const totalInsurance = (s.mortgageInsuranceMonthly || 0) * 12 * s.holdingYears;
  const totalBaselineMortgagePayments = r.totalOperationalCosts - totalTax - totalMonthlyCosts - totalInsurance;

  const totalCumNegative = r.yearly[r.yearly.length - 1]?.cumulativeNegativeCashflow || 0;

  const renovationFinancedAmount = (s.renovationCost * (s.renovationFinancedPct || 0)) / 100;
  const renovationOwnFunds = s.renovationCost - renovationFinancedAmount;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
        <h3 className="font-display text-xl mb-2">Przepływ Pieniędzy</h3>
        <p className="text-xs text-muted-foreground mb-6">
          Pełny obraz inwestycji: ile włożyłeś, ile wróciło co miesiąc, ile dostaniesz przy sprzedaży.
        </p>

        <div className="space-y-4">
          {/* ── BLOCK 1: Co zainwestowałeś ── */}
          <div className="border border-border rounded-3xl bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Wkład własny (jednorazowo)</p>
                <h4 className="font-semibold text-base">Twoje pieniądze na start</h4>
              </div>
              <div className={`font-mono font-semibold text-destructive`}>{formatSignedPLN(-r.totalUpfront)}</div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Wkład własny ({s.downPaymentPct}% ceny)</span>
                <span className="font-mono">{formatSignedPLN(-r.downPayment)}</span>
              </div>
              {renovationOwnFunds > 0 && (
                <div className="flex justify-between">
                  <span>Remont — część własna{renovationFinancedAmount > 0 ? ` (${100 - (s.renovationFinancedPct || 0)}%)` : ""}</span>
                  <span className="font-mono">{formatSignedPLN(-renovationOwnFunds)}</span>
                </div>
              )}
              {renovationFinancedAmount > 0 && (
                <div className="flex justify-between text-xs opacity-70">
                  <span>Remont — sfinansowany kredytem ({s.renovationFinancedPct}%)</span>
                  <span className="font-mono">{formatSignedPLN(-renovationFinancedAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Koszty transakcyjne</span>
                <span className="font-mono">{formatSignedPLN(-r.closingCosts)}</span>
              </div>
              {totalCumNegative > 0 && (
                <div className="flex justify-between border-t border-border/50 pt-2 mt-2">
                  <div>
                    <span>Dopłaty w ujemnych miesiącach</span>
                    <p className="text-[10px] italic opacity-70 mt-0.5">
                      Łączna kwota miesięcy, gdy koszty &gt; czynsz — już uwzględniona w cashflow poniżej
                    </p>
                  </div>
                  <span className={`font-mono ${valueToneClass(-totalCumNegative)}`}>{formatSignedPLN(-totalCumNegative)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── BLOCK 2: Co wróciło ── */}
          <div className="border border-border rounded-3xl bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Cashflow przez {s.holdingYears} lat</p>
                <h4 className="font-semibold text-base">Co wróciło co miesiąc</h4>
              </div>
              <div className={`font-mono font-semibold ${valueToneClass(r.totalCashflow)}`}>{formatSignedPLN(r.totalCashflow)}</div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Czynsz brutto (łącznie)</span>
                <span className={`font-mono ${valueToneClass(totalGrossRent)}`}>{formatSignedPLN(totalGrossRent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Minus: raty kredytu (bez nadpłat)</span>
                <span className={`font-mono ${valueToneClass(-totalBaselineMortgagePayments)}`}>
                  {formatSignedPLN(-totalBaselineMortgagePayments)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Minus: ubezpieczenie kredytu</span>
                <span className={`font-mono ${valueToneClass(-totalInsurance)}`}>{formatSignedPLN(-totalInsurance)}</span>
              </div>
              <div className="flex justify-between">
                <span>Minus: koszty stałe ({s.monthlyCosts.toFixed(0)} zł/m-c)</span>
                <span className={`font-mono ${valueToneClass(-totalMonthlyCosts)}`}>{formatSignedPLN(-totalMonthlyCosts)}</span>
              </div>
              <div className="flex justify-between">
                <span>Minus: podatek ryczałtowy ({s.taxRatePct}%)</span>
                <span className={`font-mono ${valueToneClass(-totalTax)}`}>{formatSignedPLN(-totalTax)}</span>
              </div>
              {r.totalOverpaymentPaid > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex justify-between">
                    <div>
                      <span>Minus: nadpłaty łącznie</span>
                      <p className="text-[10px] italic opacity-70 mt-0.5">Realny wydatek — budujesz kapitał szybciej</p>
                    </div>
                    <span className={`font-mono ${valueToneClass(-r.totalOverpaymentPaid)}`}>{formatSignedPLN(-r.totalOverpaymentPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs bg-success/5 rounded-lg px-3 py-2">
                    <span className="text-success">Zaoszczędzone odsetki dzięki nadpłatom</span>
                    <span className="font-mono text-success font-semibold">
                      +{formatPLN(r.totalOverpaymentPaid - r.netOverpaymentCost)}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-3 mt-1">
                <span>Cashflow netto przez {s.holdingYears} lat</span>
                <span className={`font-mono ${valueToneClass(r.totalCashflow)}`}>{formatSignedPLN(r.totalCashflow)}</span>
              </div>
            </div>

            <div className="mt-3 p-3 bg-muted/30 rounded-xl text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold">Jak sprawdzić:</span>{" "}
              czynsz ({formatPLN(totalGrossRent)}) − raty ({formatPLN(totalBaselineMortgagePayments)}) − ubezpieczenie ({formatPLN(totalInsurance)}) − koszty ({formatPLN(totalMonthlyCosts)}) − podatek ({formatPLN(totalTax)})
              {r.totalOverpaymentPaid > 0 ? ` − nadpłaty (${formatPLN(r.totalOverpaymentPaid)}) + odsetki zaoszcz. (${formatPLN(r.totalOverpaymentPaid - r.netOverpaymentCost)})` : ""}
              {" "}= <span className={cn("font-bold", r.totalCashflow >= 0 ? "text-success" : "text-destructive")}>{formatSignedPLN(r.totalCashflow)}</span>
            </div>
          </div>

          {/* ── BLOCK 3: Wyjście ── */}
          {s.sellAtEnd && (
            <div className="border border-border rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Sprzedaż po {s.holdingYears} latach</p>
                  <h4 className="font-semibold text-base">Co dostaniesz na wyjściu</h4>
                </div>
                <div className={`font-mono font-semibold ${valueToneClass(netFromSale)}`}>{formatSignedPLN(netFromSale)}</div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Szacowana cena sprzedaży</span>
                  <span className={`font-mono ${valueToneClass(r.yearly[r.yearly.length - 1].propertyValue)}`}>
                    {formatSignedPLN(r.yearly[r.yearly.length - 1].propertyValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Minus: pozostały kredyt</span>
                  <span className={`font-mono ${valueToneClass(-remainingLoan)}`}>{formatSignedPLN(-remainingLoan)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minus: koszty transakcji (~2%)</span>
                  <span className={`font-mono ${valueToneClass(-saleCosts)}`}>{formatSignedPLN(-saleCosts)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-3">
                  <span>Zysk ze sprzedaży (netto)</span>
                  <span className={`font-mono ${valueToneClass(netFromSale)}`}>{formatSignedPLN(netFromSale)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── BLOCK 4: Nadpłata ── */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Nadpłata kredytu</p>
                <h4 className="font-semibold text-base">Przyspiesz spłatę</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Chcę nadpłacać kredyt</span>
                <Switch checked={s.tsoverpaymentEnabled} onCheckedChange={(checked) => updateS({ tsoverpaymentEnabled: checked })} />
              </div>
            </div>

            {s.tsoverpaymentEnabled && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-muted/20 p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Wymagana nadpłata</p>
                  <p className="font-semibold text-lg">
                    {formatPLN(requiredOverpayment)}/m-c aby spłacić kredyt w {s.holdingYears} lat.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nadpłata miesięczna</label>
                    <Input
                      type="text"
                      placeholder={formatPLN(requiredOverpayment)}
                      value={s.overpaymentMonthly !== null ? formatLocaleAmount(s.overpaymentMonthly) : ""}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === "") {
                          updateS({ overpaymentMonthly: null });
                          return;
                        }
                        updateS({ overpaymentMonthly: Math.max(0, parseLocaleAmount(value)) });
                      }}
                      className="h-11 text-right font-mono bg-background border-border"
                    />
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Efektywna nadpłata</p>
                    <p className="font-display text-2xl mt-2">{formatPLN(s.overpaymentMonthly ?? requiredOverpayment)}</p>
                  </div>
                </div>

                {s.overpaymentMonthly !== null && s.overpaymentMonthly < requiredOverpayment && (
                  <div className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
                    Kredyt nie zostanie spłacony w czasie analizy. Pozostała kwota: <span className="font-semibold">{formatPLN(remainingLoan)}</span>
                  </div>
                )}

                {r.totalOverpaymentPaid > 0 && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-success uppercase tracking-wider">Efekt nadpłat przez {s.holdingYears} lat</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Suma nadpłat</p>
                        <p className="font-mono font-semibold">{formatPLN(r.totalOverpaymentPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Zaoszczędzone odsetki</p>
                        <p className="font-mono font-semibold text-success">
                          +{formatPLN(r.totalOverpaymentPaid - r.netOverpaymentCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Netto koszt nadpłat</p>
                        <p className="font-mono font-semibold text-muted-foreground">{formatPLN(r.netOverpaymentCost)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SUMMARY ── */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Podsumowanie inwestycji</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Wkład własny na start</span>
                <span className="font-mono text-destructive">
                  {formatSignedPLN(-r.totalUpfront)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cashflow przez {s.holdingYears} lat</span>
                <span className={`font-mono ${valueToneClass(r.totalCashflow)}`}>
                  {formatSignedPLN(r.totalCashflow)}
                </span>
              </div>
              {s.sellAtEnd && (
                <div className="flex justify-between">
                  <span>Zysk ze sprzedaży (netto)</span>
                  <span className={`font-mono ${valueToneClass(netFromSale)}`}>{formatSignedPLN(netFromSale)}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
                <span>Zysk / Strata</span>
                <span className={cn("font-display", finalProfit >= 0 ? "text-success" : "text-destructive")}>
                  {finalProfit >= 0 ? "+" : ""}{formatPLN(finalProfit)} ({finalProfitPct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>CAGR (przybliżone IRR)</span>
                <span className="font-mono">{r.irrAnnualPct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/20 rounded-xl text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold">Jak sprawdzić wynik: </span>
              cashflow ({formatSignedPLN(r.totalCashflow)})
              {s.sellAtEnd ? ` + sprzedaż (${formatSignedPLN(netFromSale)})` : ""}
              {" "}− wkład własny ({formatPLN(r.totalUpfront)})
              {" "}= <span className={cn("font-bold", finalProfit >= 0 ? "text-success" : "text-destructive")}>{formatSignedPLN(finalProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RiskTab ──────────────────────────────────────────────────────────────────
function RiskTab() {
  const { s, r } = useRealEstate();

  const rentSteps = [s.monthlyRent - 1000, s.monthlyRent - 500, s.monthlyRent, s.monthlyRent + 500, s.monthlyRent + 1000];
  const rateSteps = [s.mortgageRatePct - 2, s.mortgageRatePct - 1, s.mortgageRatePct, s.mortgageRatePct + 1, s.mortgageRatePct + 2];

  const safeRateSteps = rateSteps.map(r => Math.max(0.1, r));
  const safeRentSteps = rentSteps.map(r => Math.max(0, r));

  const isCurrentCell = (rentIdx: number, rateIdx: number) => rentIdx === 2 && rateIdx === 2;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm overflow-x-auto">
        <div className="mb-6">
          <h3 className="font-display text-xl mb-1 flex items-center gap-2">
            Analiza "Co jeśli?"
          </h3>
          <p className="text-xs text-muted-foreground">Jak zmiana stóp procentowych i czynszu wpłynie na miesięczny zysk przy pełnym wynajmie.</p>
        </div>

        <div className="min-w-[500px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th rowSpan={2} colSpan={2} className="border-b-2 border-r-2 border-border/50 bg-muted/20"></th>
                <th colSpan={5} className="py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/50 bg-muted/10">Czynsz brutto</th>
              </tr>
              <tr>
                {safeRentSteps.map((rent, i) => (
                  <th key={i} className="py-2 font-mono text-sm border-b-2 border-border/50 bg-muted/10 font-bold">{formatPLN(rent)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeRateSteps.map((rate, rIdx) => (
                <tr key={rIdx}>
                  {rIdx === 0 && (
                    <th rowSpan={5} className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground border-r border-border/50 [writing-mode:vertical-lr] rotate-180 bg-muted/10">
                      Oprocentowanie
                    </th>
                  )}
                  <th className="py-3 px-3 text-right font-mono text-sm border-r-2 border-border/50 bg-muted/10 font-bold">{rate.toFixed(1)}%</th>
                  {safeRentSteps.map((rent, cIdx) => {
                    const result = calculateRealEstate({ ...s, monthlyRent: rent, mortgageRatePct: rate });
                    const cf = result.monthlyCashflow;
                    const tone = cf < 0 ? "bg-destructive/10 text-destructive border-destructive/20" : cf < 300 ? "bg-warning/10 text-warning-foreground border-warning/20" : "bg-success/10 text-success border-success/20";
                    return (
                      <td key={cIdx} className="p-1">
                        <div className={cn(
                          "py-2 px-1 text-center font-mono text-xs font-bold rounded-md border",
                          tone,
                          isCurrentCell(cIdx, rIdx) && "ring-2 ring-foreground shadow-sm bg-background border-none"
                        )}>
                          {cf > 0 ? "+" : ""}{cf.toFixed(0)} zł
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
        <h3 className="font-display text-xl mb-4">Czynniki Ryzyka</h3>
        <div className="space-y-4">
          <RiskFactor
            label="Ryzyko stopy procentowej"
            level={s.mortgageRatePct > 5 ? "Wysokie" : "Średnie"}
            fill={s.mortgageRatePct > 5 ? 80 : 50}
            desc="Kredyt jest podatny na wahania WIBOR."
            tone={s.mortgageRatePct > 5 ? "destructive" : "warning"}
          />
          <RiskFactor
            label="Obciążenie budżetu (DTI)"
            level={r.monthlyPmt > 3000 ? "Wysokie" : "Średnie"}
            fill={Math.min(100, (r.monthlyPmt / 4000) * 100)}
            desc={`Rata kredytu to ${formatPLN(r.monthlyPmt)}/m-c (zanim wynajmiesz).`}
            tone={r.monthlyPmt > 3000 ? "destructive" : "warning"}
          />
        </div>
      </div>
    </div>
  );
}

function RiskFactor({ label, level, desc, fill, tone }: {
  label: string; level: string; desc: string; fill: number; tone: "destructive" | "warning" | "success";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-bold">{label}</span>
        <span className={cn("text-xs font-bold uppercase tracking-widest", tone === "destructive" ? "text-destructive" : "text-warning-foreground")}>{level}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", tone === "destructive" ? "bg-destructive" : "bg-warning")} style={{ width: `${Math.min(100, Math.max(0, fill))}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground italic">{desc}</p>
    </div>
  );
}

// ─── BudgetTab ────────────────────────────────────────────────────────────────
import { ShieldAlert } from "lucide-react";

function BudgetTab() {
  const { r, budgetImpact, s } = useRealEstate();

  const dtiBefore = budgetImpact.totalNetIncome > 0
    ? (budgetImpact.totalNetIncome - budgetImpact.currentDisposable) / budgetImpact.totalNetIncome * 100
    : 0;
  const dtiAfter = budgetImpact.totalDTI;
  const dtiTone = dtiAfter > 50 ? "destructive" : dtiAfter > 35 ? "warning" : "success";

  const saveToPortfolio = () => {
    const rentalData = {
      label: `Scenariusz: ${s.purchasePrice ? formatPLN(s.purchasePrice) : 'Nieruchomość'}`,
      monthlyRent: s.monthlyRent,
      monthlyCosts: s.monthlyCosts,
      monthlyMortgage: r.monthlyPmt,
      taxRatePct: s.taxRatePct,
      marketValue: s.purchasePrice,
      purchasePrice: s.purchasePrice,
      purchaseDate: new Date().toISOString().slice(0, 10),
      renovationCost: s.renovationCost,
      closingCostsPct: 2.5,
      hasLoanLink: false,
      linkedLoanId: undefined,
      mortgageRatePct: s.mortgageRatePct,
      mortgageYears: s.mortgageYears,
      mortgageRemaining: s.mortgageYears * 12,
      mortgageMonthly: r.monthlyPmt,
      mortgageInsuranceMonthly: s.mortgageInsuranceMonthly,
      appreciationPct: 4,
      rentGrowthPct: 3,
      vacancyMonthsPerYear: (s.renovationMonths || 0) + (s.tenantSearchMonths || 0),
    };

    actions.addRental(rentalData);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm opacity-80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-4">Przed Inwestycją</p>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-sm">Dochód netto</span>
              <span className="font-mono text-sm">{formatPLN(budgetImpact.totalNetIncome)}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-sm">Wydatki stałe i raty</span>
              <span className="font-mono text-sm">-{formatPLN(budgetImpact.totalNetIncome - budgetImpact.currentDisposable)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold">Nadwyżka w portfelu</span>
              <span className="font-display text-xl">{formatPLN(budgetImpact.currentDisposable)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-6 sm:p-8 border border-accent/20 shadow-sm relative overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-4">Po Inwestycji</p>
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between border-b border-accent/20 pb-2">
              <span className="text-sm font-medium">Dochód + Wynajem</span>
              <span className="font-mono text-sm text-success">{formatPLN(budgetImpact.totalNetIncome + s.monthlyRent)}</span>
            </div>
            <div className="flex justify-between border-b border-accent/20 pb-2">
              <span className="text-sm font-medium">Wydatki + Rata + Koszty</span>
              <span className="font-mono text-sm text-destructive">
                -{formatPLN(budgetImpact.totalNetIncome - budgetImpact.currentDisposable + r.monthlyPmt + s.monthlyCosts + r.monthlyTax + s.mortgageInsuranceMonthly)}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold">Nadwyżka w portfelu</span>
              <div className="text-right">
                <span className="font-display text-2xl">{formatPLN(budgetImpact.newDisposable)}</span>
                <p className={cn("text-[10px] uppercase tracking-widest font-bold mt-1", r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>
                  {r.monthlyCashflow >= 0 ? "+" : ""}{formatPLN(r.monthlyCashflow)} zysku z najmu
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(
        "rounded-2xl p-5 border flex gap-3",
        dtiTone === "destructive" ? "bg-destructive/10 border-destructive/20" :
          dtiTone === "warning" ? "bg-warning/10 border-warning/20" : "bg-success/10 border-success/20"
      )}>
        <ShieldAlert className={cn("w-6 h-6 shrink-0", dtiTone === "destructive" ? "text-destructive" : dtiTone === "warning" ? "text-warning-foreground" : "text-success")} />
        <div>
          <h4 className="font-bold text-sm">Wskaźnik obciążenia ratami (DTI)</h4>
          <p className="font-mono text-lg font-bold mt-1">
            {dtiBefore.toFixed(0)}% <span className="text-muted-foreground mx-2">→</span> {dtiAfter.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {dtiTone === "destructive"
              ? "⚠ Uwaga: Raty pochłoną ponad połowę Twoich dochodów. Bank może odmówić kredytu przy takim poziomie."
              : dtiTone === "warning"
                ? "⚠ Ostrożnie: Raty pochłoną znaczną część budżetu. Zostanie mniej na nieprzewidziane wydatki."
                : "✓ Bezpieczny poziom zadłużenia. Twój budżet zachowuje dużą elastyczność."
            }
          </p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={saveToPortfolio}
          className="rounded-full bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold border-0 px-6"
        >
          <Save className="w-4 h-4 mr-2" />
          Zapisz do portfela nieruchomości
        </Button>
      </div>
    </div>
  );
}