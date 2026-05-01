import { useRealEstate } from "./context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine
} from "recharts";
import { calculateRealEstate } from "@/lib/finance";
import { AlertTriangle, Info, ShieldAlert, CheckCircle2 } from "lucide-react";

export function InsightPanel() {
  return (
    <Tabs defaultValue="cashflow" className="space-y-6">
      <TabsList className="w-full flex sm:w-auto overflow-x-auto bg-transparent p-0 border-b border-border/40 rounded-none h-auto justify-start">
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
      </TabsList>

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
    </Tabs>
  );
}

function CashflowTab() {
  const { s, r, minRent, rentMargin, rentMarginPct } = useRealEstate();

  const waterfallSteps = [
    { label: "Czynsz brutto", value: s.monthlyRent, tone: "accent" as const },

    { label: "Czynsz efektywny", value: r.effectiveRent, tone: "subtotal" as const },
    { label: "Koszty stałe", value: -s.monthlyCosts, tone: "muted" as const },
    {
      label: "Rata kredytu", value: -r.monthlyPmt, tone: "destructive" as const,
      subs: [
        { label: "z czego odsetki (średnio 1 rok)", value: -((r.monthlyPmt * 12 - (s.purchasePrice - s.purchasePrice * s.downPaymentPct / 100 - r.yearly[0]?.loanBalance)) / 12) },
      ]
    },
    { label: "Ubezpieczenie", value: -s.mortgageInsuranceMonthly, tone: "destructive" as const },
    { label: "Podatek", value: -r.monthlyTax, tone: "warning" as const },
  ];

  const totalWidth = s.monthlyRent;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm space-y-6">
        <div>
          <h3 className="font-display text-xl mb-1">Gdzie uciekają pieniądze?</h3>
          <p className="text-xs text-muted-foreground">Analiza od wpłaty najemcy do Twojego zysku "na rękę".</p>
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
                  <span className={cn("text-[11px] font-bold uppercase tracking-widest", isSub ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
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
                            step.tone === "warning" ? "bg-warning" : "bg-muted-foreground/40"
                      )}
                      style={{ width: `${pct}%` }}
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
              <span className="font-display text-lg">Zysk na czysto</span>
              <div className="text-right">
                <p className={cn(
                  "font-display text-2xl font-bold leading-none",
                  r.monthlyCashflow >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatPLN(r.monthlyCashflow)}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">co miesiąc</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Całkowity koszt posiadania</p>
          <p className="font-mono text-lg font-bold">{formatPLN(s.monthlyCosts + r.monthlyPmt + s.mortgageInsuranceMonthly + r.monthlyTax)}</p>
          <p className="text-xs text-muted-foreground mt-1">Suma comiesięcznych zobowiązań.</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Efektywna stawka podatku</p>
          <p className="font-mono text-lg font-bold">{(s.taxRatePct).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Względem czynszu brutto.</p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Próg opłacalności</p>
          <p className="font-mono text-lg font-bold">{formatPLN(minRent)}</p>
          <p className={cn("text-xs mt-1 font-bold", rentMargin >= 0 ? "text-success" : "text-destructive")}>
            Zapas: {rentMargin >= 0 ? "+" : ""}{formatPLN(rentMargin)} ({rentMarginPct.toFixed(0)}%)
          </p>
        </div>
      </div>
    </div>
  );
}

function LongtermTab() {
  const { r, s } = useRealEstate();
  const finalProfit = s.sellAtEnd ? r.totalReturn : r.totalReturnNoSale;
  const finalProfitPct = s.sellAtEnd ? r.totalReturnPct : r.totalReturnNoSalePct;
  const propertyValueAtEnd = r.yearly[r.yearly.length - 1].propertyValue;
  const remainingLoan = r.yearly[r.yearly.length - 1].loanBalance;
  const netFromSale = r.netFromSale;
  const saleCosts = r.saleCosts;
  const formatSignedPLN = (value: number) => (value >= 0 ? `+${formatPLN(value)}` : formatPLN(value));
  const valueTone = (value: number) => (value >= 0 ? "text-success" : "text-destructive");

  // Calculate milestones
  const breakEvenYear = r.breakEvenMonths > 0 ? Math.ceil(r.breakEvenMonths / 12) : null;
  const cfPositiveYear = r.yearly.findIndex(y => y.cashflow > 0) + 1;
  const halfPaidYear = r.yearly.findIndex(y => y.loanBalance <= r.loanAmount / 2) + 1;

  const milestones = [
    { year: cfPositiveYear > 0 ? cfPositiveYear : null, label: "Zaczynasz zarabiać co miesiąc" },
    { year: breakEvenYear, label: "Zwrot włożonej gotówki (Próg opłacalności)" },
    { year: halfPaidYear > 0 ? halfPaidYear : null, label: "Spłacasz połowę kredytu" },
    { year: s.holdingYears, label: `Zysk po sprzedaży i spłacie: ${formatPLN(r.totalReturn)}` },
  ].filter(m => m.year !== null && m.year <= s.holdingYears).sort((a, b) => (a.year as number) - (b.year as number));

  // De-duplicate milestones by year if they fall on the same year
  const groupedMilestones = milestones.reduce((acc, curr) => {
    const existing = acc.find(m => m.year === curr.year);
    if (existing) {
      existing.label += ` & ${curr.label}`;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as typeof milestones);

  // Prepare chart data format where debt is negative for stacked view below 0
  const chartData = r.yearly.map(y => ({
    ...y,
    negativeLoan: -y.loanBalance,
  }));

  const investedCapital = r.totalUpfront; // simplified
  const equityGain = r.finalEquity - r.totalUpfront; // this is simplified

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

      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
        <h3 className="font-display text-xl mb-4">Przepływ Pieniędzy</h3>
        <div className="text-xs text-muted-foreground mb-6">
          Klarowny podział na to, co zainwestowałeś, co wróciło w trakcie, i co dostaniesz na wyjściu.
        </div>

        <div className="space-y-6">
          {/* Zone 1: What you invested */}
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Co zainwestowałeś (pieniądze z Twojej kieszeni)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Inwestycja początkowa (zaliczka + koszty + remont)</span>
                <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(r.totalUpfront)}</span>
              </div>
              {r.yearly.length > 0 && r.yearly[r.yearly.length - 1].cumulativeNegativeCashflow > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Dopłaty w miesiącach ujemnego cashflow</span>
                  <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(r.yearly[r.yearly.length - 1].cumulativeNegativeCashflow)}</span>
                </div>
              )}
              <div className="border-t border-red-200 dark:border-red-800 pt-2 flex justify-between font-semibold">
                <span>Łącznie zainwestowane</span>
                <span className="font-mono text-red-800 dark:text-red-200">-{formatPLN(r.totalUpfront + (r.yearly[r.yearly.length - 1]?.cumulativeNegativeCashflow || 0))}</span>
              </div>
            </div>
          </div>

          {/* Zone 2: What came back during holding */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Co wróciło w trakcie trzymania (już w Twojej kieszeni)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gross rent collected</span>
                <span className="font-mono text-green-600 dark:text-green-400">+{formatPLN(r.yearly.reduce((sum, y) => sum + y.rent, 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Minus: wszystkie koszty (mortgage + ubezpieczenie + koszty stałe + podatek)</span>
                <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(r.yearly.reduce((sum, y) => sum + y.rent - y.cashflow, 0))}</span>
              </div>
              <div className="border-t border-green-200 dark:border-green-800 pt-2 flex justify-between font-semibold">
                <span>Net cashflow w trakcie (już otrzymane)</span>
                <span className="font-mono text-green-800 dark:text-green-200">{r.totalCashflow >= 0 ? '+' : ''}{formatPLN(r.totalCashflow)}</span>
              </div>
            </div>
          </div>

          {/* Zone 3: What you get on exit */}
          {s.sellAtEnd && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Co dostaniesz na wyjściu (jednorazowe zdarzenie)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cena sprzedaży nieruchomości</span>
                  <span className="font-mono text-green-600 dark:text-green-400">+{formatPLN(propertyValueAtEnd)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Minus: pozostały kredyt do spłaty</span>
                  <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(remainingLoan)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Minus: koszty transakcji sprzedaży (~2% prowizja)</span>
                  <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(saleCosts)}</span>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex justify-between font-semibold">
                  <span>Netto ze sprzedaży</span>
                  <span className="font-mono text-blue-800 dark:text-blue-200">{netFromSale >= 0 ? '+' : ''}{formatPLN(netFromSale)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom line */}
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h4 className="font-semibold mb-3">Twój całkowity zwrot</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Łącznie zainwestowane</span>
                <span className="font-mono text-red-600 dark:text-red-400">-{formatPLN(r.totalUpfront + (r.yearly[r.yearly.length - 1]?.cumulativeNegativeCashflow || 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Łącznie zwrócone</span>
                <span className="font-mono text-green-600 dark:text-green-400">+{formatPLN(r.totalCashflow + (s.sellAtEnd ? netFromSale : 0))}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                <span>Zysk/Strata</span>
                <span className={cn("font-display", finalProfit >= 0 ? "text-success" : "text-destructive")}>
                  {finalProfit >= 0 ? "+" : ""}{formatPLN(finalProfit)} ({finalProfitPct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Annual IRR</span>
                <span className="font-mono">{r.irrAnnualPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskTab() {
  const { s, r } = useRealEstate();

  // Generate 2D matrix
  const rentSteps = [s.monthlyRent - 1000, s.monthlyRent - 500, s.monthlyRent, s.monthlyRent + 500, s.monthlyRent + 1000];
  const rateSteps = [s.mortgageRatePct - 2, s.mortgageRatePct - 1, s.mortgageRatePct, s.mortgageRatePct + 1, s.mortgageRatePct + 2];

  // Calculate matrix safely (ignoring impossible negative rates)
  const safeRateSteps = rateSteps.map(r => Math.max(0.1, r));
  const safeRentSteps = rentSteps.map(r => Math.max(0, r));

  const isCurrentCell = (rentIdx: number, rateIdx: number) => rentIdx === 2 && rateIdx === 2; // middle is current

  // Calculate CF for each cell
  // calculateRealEstate is imported at the top level

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm overflow-x-auto">
        <div className="mb-6">
          <h3 className="font-display text-xl mb-1 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning-foreground" /> Analiza "Co jeśli?"</h3>
          <p className="text-xs text-muted-foreground">Jak zmiana stóp procentowych i czynszu wpłynie na Twój miesięczny portfel.</p>
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
                  {rIdx === 0 && <th rowSpan={5} className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground border-r border-border/50 [writing-mode:vertical-lr] rotate-180 bg-muted/10">Oprocentowanie</th>}
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

function RiskFactor({ label, level, desc, fill, tone }: { label: string, level: string, desc: string, fill: number, tone: "destructive" | "warning" | "success" }) {
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

function BudgetTab() {
  const { r, budgetImpact, s } = useRealEstate();

  const dtiBefore = budgetImpact.totalNetIncome > 0 ? (budgetImpact.totalNetIncome - budgetImpact.currentDisposable) / budgetImpact.totalNetIncome * 100 : 0;
  const dtiAfter = budgetImpact.totalDTI; // Note: totalDTI is calculated as (existingPayments + newMortgage) / income

  const dtiTone = dtiAfter > 50 ? "destructive" : dtiAfter > 35 ? "warning" : "success";

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Before */}
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

        {/* After */}
        <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-6 sm:p-8 border border-accent/20 shadow-sm relative overflow-hidden">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-4">Po Inwestycji</p>
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between border-b border-accent/20 pb-2">
              <span className="text-sm font-medium">Dochód + Wynajem</span>
              <span className="font-mono text-sm text-success">{formatPLN(budgetImpact.totalNetIncome + s.monthlyRent)}</span>
            </div>
            <div className="flex justify-between border-b border-accent/20 pb-2">
              <span className="text-sm font-medium">Wydatki + Rata + Koszty</span>
              <span className="font-mono text-sm text-destructive">-{formatPLN(budgetImpact.totalNetIncome - budgetImpact.currentDisposable + r.monthlyPmt + s.monthlyCosts + r.monthlyTax + s.mortgageInsuranceMonthly)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold">Nadwyżka w portfelu</span>
              <div className="text-right">
                <span className="font-display text-2xl">{formatPLN(budgetImpact.newDisposable)}</span>
                <p className={cn("text-[10px] uppercase tracking-widest font-bold mt-1", r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>
                  {r.monthlyCashflow >= 0 ? "+" : ""}{formatPLN(r.monthlyCashflow)} zysku
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
            {dtiTone === "destructive" ? "⚠ Uwaga: Raty pochłoną ponad połowę Twoich dochodów. Bank może odmówić kredytu przy takim poziomie." :
              dtiTone === "warning" ? "⚠ Ostrożnie: Raty pochłoną znaczną część budżetu. Zostanie mniej na nieprzewidziane wydatki." :
              "✓ Bezpieczny poziom zadłużenia. Twój budżet zachowuje dużą elastyczność."}
          </p>
        </div>
      </div>
    </div>
  );
}
