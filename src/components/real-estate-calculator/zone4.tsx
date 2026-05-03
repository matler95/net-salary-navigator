import { useState, useMemo } from "react";
import { useRealEstate } from "./context";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { cn } from "@/lib/utils";
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
} from "recharts";
import {
  TrendingUp,
  Info,
  AlertTriangle,
  ChevronDown,
  Shield,
  Percent,
  RefreshCw,
} from "lucide-react";
import {
  OBLIGACJE_CATALOG,
  projectBond,
  getBondAssumptionLabel,
  NBP_REFERENCE_RATE_PCT,
  CURRENT_CPI_ESTIMATE_PCT,
  BELKA_TAX_PCT,
  type BondProjection,
  type ObligacjaBond,
} from "@/lib/obligacje";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";

const BOND_COLORS: Record<string, string> = {
  OTS: "oklch(0.62 0.13 175)",
  ROR: "oklch(0.55 0.14 210)",
  DOR: "oklch(0.50 0.14 245)",
  TOS: "oklch(0.74 0.13 75)",
  COI: "oklch(0.62 0.14 148)",
  EDO: "oklch(0.56 0.19 25)",
};

const CATEGORY_LABELS: Record<string, string> = {
  fixed: "Stałe",
  nbp_indexed: "Zmienna (NBP)",
  cpi_indexed: "Indeksowana CPI",
};

const CATEGORY_BADGE: Record<string, string> = {
  fixed: "bg-accent/10 text-accent border-accent/20",
  nbp_indexed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cpi_indexed: "bg-success/10 text-success border-success/20",
};

function BondBadge({ category }: { category: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        CATEGORY_BADGE[category] ?? "bg-muted text-muted-foreground",
      )}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function VerdictBadge({ proj, realIrr }: { proj: BondProjection; realIrr: number }) {
  const diff = proj.irrAnnualNetPct - realIrr;
  if (diff > 1)
    return (
      <span className="text-[10px] font-bold text-success bg-success/10 rounded-full px-2 py-0.5 border border-success/20">
        +{diff.toFixed(1)}% lepiej
      </span>
    );
  if (diff < -1)
    return (
      <span className="text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-2 py-0.5 border border-destructive/20">
        {diff.toFixed(1)}% gorzej
      </span>
    );
  return (
    <span className="text-[10px] font-bold text-warning-foreground bg-warning/10 rounded-full px-2 py-0.5 border border-warning/20">
      Zbliżone
    </span>
  );
}

export function ObligacjeTab() {
  const { r, s } = useRealEstate();

  // Use totalUpfront as the "alternative investment" amount
  const investmentAmount = r.totalUpfront;
  const holdingYears = s.holdingYears;
  const realEstateIrrNet = r.irrAnnualPct; // already roughly net of tax in RE context

  // User-adjustable assumptions
  const [assumedNbp, setAssumedNbp] = useState(NBP_REFERENCE_RATE_PCT);
  const [assumedCpi, setAssumedCpi] = useState(CURRENT_CPI_ESTIMATE_PCT);
  const [selectedBonds, setSelectedBonds] = useState<string[]>(["TOS", "COI", "EDO"]);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [expandedBond, setExpandedBond] = useState<string | null>(null);

  const projections = useMemo(() => {
    return OBLIGACJE_CATALOG.filter((b) => selectedBonds.includes(b.symbol)).map((bond) =>
      projectBond(bond, investmentAmount, holdingYears, assumedCpi, assumedNbp),
    );
  }, [selectedBonds, investmentAmount, holdingYears, assumedCpi, assumedNbp]);

  // All projections for chart (to compare lines)
  const allProjections = useMemo(
    () =>
      OBLIGACJE_CATALOG.map((bond) =>
        projectBond(bond, investmentAmount, holdingYears, assumedCpi, assumedNbp),
      ),
    [investmentAmount, holdingYears, assumedCpi, assumedNbp],
  );

  // Real estate net value projection per year
  const realEstateByYear = useMemo(() => {
    return s.holdingYears > 0
      ? r.yearly.map((y) => ({
          year: y.year,
          value: y.equity + y.cumulativeCashflow,
        }))
      : [];
  }, [r.yearly, s.holdingYears]);

  // Build unified chart data
  const chartData = useMemo(() => {
    return Array.from({ length: holdingYears }, (_, i) => {
      const year = i + 1;
      const point: Record<string, number | string> = { year: `${year}r` };

      // Real estate equity + cumulative cashflow vs initial investment
      const rePoint = realEstateByYear.find((p) => p.year === year);
      point["Nieruchomość"] = rePoint ? round2(rePoint.value) : 0;

      // Each bond final value at this year
      for (const proj of allProjections) {
        const yearlyPoint = proj.yearly[Math.min(i, proj.yearly.length - 1)];
        point[proj.bond.symbol] = yearlyPoint ? yearlyPoint.nominalValueNet : investmentAmount;
      }

      return point;
    });
  }, [allProjections, realEstateByYear, holdingYears, investmentAmount]);

  const bestBond = allProjections.reduce((best, p) =>
    p.irrAnnualNetPct > best.irrAnnualNetPct ? p : best,
  );

  // Sort projections by net IRR descending
  const sortedProjections = [...projections].sort(
    (a, b) => b.irrAnnualNetPct - a.irrAnnualNetPct,
  );

  const toggleBond = (symbol: string) => {
    setSelectedBonds((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  };

  if (investmentAmount <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">
          Uzupełnij parametry inwestycji, aby zobaczyć porównanie z obligacjami.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header context card */}
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-xl mb-1">
              Obligacje jako alternatywa
            </h3>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Zakładamy, że zamiast kupić nieruchomość, inwestujesz ten sam wkład własny{" "}
              <strong className="text-foreground">{formatPLN(investmentAmount)}</strong> w
              Obligacje Skarbu Państwa przez{" "}
              <strong className="text-foreground">{holdingYears} lat</strong>. Dane obligacji
              aktualne na 2025 r. (gov.pl).
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-accent/5 rounded-2xl px-4 py-3 border border-accent/10 min-w-max">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                IRR Nieruchomości
              </p>
              <p className="font-display text-2xl font-bold text-accent">
                {realEstateIrrNet.toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground">rocznie (CAGR)</p>
            </div>
          </div>
        </div>

        {/* Assumptions accordion */}
        <Collapsible open={showAssumptions} onOpenChange={setShowAssumptions}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mt-2">
              <RefreshCw className="w-3 h-3" />
              Założenia makroekonomiczne
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform",
                  showAssumptions && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid sm:grid-cols-2 gap-6 bg-muted/30 p-4 rounded-2xl border border-border/50">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stopa NBP (referencyjna)
                  </label>
                  <span className="font-mono font-bold text-sm text-accent">
                    {assumedNbp.toFixed(2)}%
                  </span>
                </div>
                <Slider
                  value={[assumedNbp]}
                  min={0}
                  max={12}
                  step={0.25}
                  onValueChange={([v]) => setAssumedNbp(v)}
                  className="[&>span:first-child]:bg-accent"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Aktualna: {NBP_REFERENCE_RATE_PCT}% · Wpływa na obligacje ROR i DOR
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Prognozowana inflacja CPI
                  </label>
                  <span className="font-mono font-bold text-sm text-success">
                    {assumedCpi.toFixed(2)}%
                  </span>
                </div>
                <Slider
                  value={[assumedCpi]}
                  min={0}
                  max={15}
                  step={0.25}
                  onValueChange={([v]) => setAssumedCpi(v)}
                  className="[&>span:first-child]:bg-success"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Proj. NBP 2025: ~{CURRENT_CPI_ESTIMATE_PCT}% · Wpływa na COI i EDO od roku 2
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[10px] text-muted-foreground bg-warning/5 border border-warning/20 rounded-xl p-3">
              <Info className="w-3.5 h-3.5 shrink-0 text-warning-foreground mt-0.5" />
              <p>
                Dla obligacji zmiennoprocentowych (ROR, DOR) zakładamy{" "}
                <strong>stały poziom stopy NBP</strong> przez cały horyzont analizy. W
                rzeczywistości stopy mogą się zmieniać. Dla obligacji CPI-indexed (COI, EDO)
                zakładamy <strong>stałą inflację CPI</strong>.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bond selector */}
      <div className="bg-card rounded-3xl p-5 border border-border shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Wybierz obligacje do analizy
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OBLIGACJE_CATALOG.map((bond) => {
            const isSelected = selectedBonds.includes(bond.symbol);
            const color = BOND_COLORS[bond.symbol] ?? "var(--accent)";
            const tenorYears = bond.tenorMonths / 12;
            const isEarly = holdingYears < tenorYears;
            return (
              <button
                key={bond.symbol}
                onClick={() => toggleBond(bond.symbol)}
                className={cn(
                  "text-left rounded-2xl p-3.5 border transition-all duration-200 relative",
                  isSelected
                    ? "bg-card border-current shadow-sm"
                    : "bg-muted/20 border-transparent opacity-60 hover:opacity-80",
                )}
                style={isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}22` } : {}}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span
                    className="font-display font-bold text-lg leading-none"
                    style={{ color: isSelected ? color : undefined }}
                  >
                    {bond.symbol}
                  </span>
                  {isEarly && isSelected && (
                    <AlertTriangle className="w-3 h-3 text-warning-foreground shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight mb-2">
                  {tenorYears === 0.25
                    ? "3 m-ce"
                    : tenorYears === 1
                      ? "1 rok"
                      : `${tenorYears} lat`}
                </p>
                <BondBadge category={bond.category} />
                {isEarly && isSelected && (
                  <p className="text-[9px] text-warning-foreground mt-1.5 font-medium">
                    Wcześniejszy wykup
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart: value over time */}
      {projections.length > 0 && (
        <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
          <h3 className="font-display text-lg mb-1">Wzrost wartości w czasie</h3>
          <p className="text-xs text-muted-foreground mb-6">
            Wartość netto (po podatku Belki {BELKA_TAX_PCT}%) w zł. Nieruchomość = equity +
            skumulowany cashflow.
          </p>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.9 0.015 85)"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [formatPLN(v), name]}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-elevated)",
                    backgroundColor: "var(--card)",
                  }}
                  labelFormatter={(l) => `Po ${l}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
                <ReferenceLine
                  y={investmentAmount}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: "Wkład własny",
                    fontSize: 9,
                    fill: "var(--muted-foreground)",
                    position: "insideTopLeft",
                  }}
                />
                {/* Real estate line */}
                <Line
                  type="monotone"
                  dataKey="Nieruchomość"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
                />
                {/* Selected bond lines */}
                {projections.map((proj) => (
                  <Line
                    key={proj.bond.symbol}
                    type="monotone"
                    dataKey={proj.bond.symbol}
                    stroke={BOND_COLORS[proj.bond.symbol] ?? "var(--muted-foreground)"}
                    strokeWidth={2}
                    strokeDasharray={proj.isEarlyRedemption ? "6 3" : undefined}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-muted-foreground text-center mt-2 italic">
            Linie przerywane = wcześniejszy wykup przed terminem zapadalności obligacji.
          </p>
        </div>
      )}

      {/* Bond cards */}
      {sortedProjections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Szczegóły per obligacja
            </p>
            <p className="text-[10px] text-muted-foreground">
              Posortowane wg. CAGR netto malejąco
            </p>
          </div>

          {sortedProjections.map((proj) => {
            const color = BOND_COLORS[proj.bond.symbol] ?? "var(--accent)";
            const tenorYears = proj.bond.tenorMonths / 12;
            const isExpanded = expandedBond === proj.bond.symbol;
            const diff = proj.irrAnnualNetPct - realEstateIrrNet;
            const isBetter = diff > 0;

            return (
              <Collapsible
                key={proj.bond.symbol}
                open={isExpanded}
                onOpenChange={(v) => setExpandedBond(v ? proj.bond.symbol : null)}
              >
                <div
                  className="bg-card rounded-3xl border overflow-hidden shadow-sm transition-all"
                  style={{ borderColor: isExpanded ? color : undefined }}
                >
                  {/* Card header */}
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left p-5 sm:p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Symbol badge */}
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg shrink-0 text-white"
                          style={{ backgroundColor: color }}
                        >
                          {proj.bond.symbol}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-sm">{proj.bond.name}</p>
                            <BondBadge category={proj.bond.category} />
                            {proj.isEarlyRedemption && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-warning/10 text-warning-foreground border border-warning/20 rounded-full px-2 py-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Wcześniejszy wykup
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {getBondAssumptionLabel(proj.bond)} ·{" "}
                            {tenorYears < 1
                              ? `${proj.bond.tenorMonths} m-ce`
                              : `${tenorYears} lat`}{" "}
                            · Belka {BELKA_TAX_PCT}%
                          </p>
                        </div>

                        {/* Right metrics */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <VerdictBadge proj={proj} realIrr={realEstateIrrNet} />
                          </div>
                          <p
                            className={cn(
                              "font-display text-2xl font-bold leading-none",
                              isBetter ? "text-success" : "text-destructive",
                            )}
                          >
                            {proj.irrAnnualNetPct.toFixed(1)}%
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                            CAGR netto
                          </p>
                        </div>
                      </div>

                      {/* Warning message */}
                      {proj.warningMessage && (
                        <div className="mt-3 flex items-start gap-2 bg-warning/5 border border-warning/15 rounded-xl p-2.5 text-[10px] text-warning-foreground">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <p>{proj.warningMessage}</p>
                        </div>
                      )}

                      {/* Quick stats row */}
                      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/50">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Wartość netto
                          </p>
                          <p className="font-mono text-xs font-bold">
                            {formatPLN(proj.finalValueNet)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Zysk netto
                          </p>
                          <p className="font-mono text-xs font-bold text-success">
                            +{formatPLN(proj.totalNetInterest)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Kara wykupu
                          </p>
                          <p
                            className={cn(
                              "font-mono text-xs font-bold",
                              proj.penaltyTotal > 0 ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {proj.penaltyTotal > 0 ? `-${formatPLN(proj.penaltyTotal)}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Vs. RE
                          </p>
                          <p
                            className={cn(
                              "font-mono text-xs font-bold",
                              isBetter ? "text-success" : "text-destructive",
                            )}
                          >
                            {isBetter ? "+" : ""}
                            {diff.toFixed(1)}% p.a.
                          </p>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  {/* Expanded: year-by-year table + description */}
                  <CollapsibleContent>
                    <div className="px-5 sm:px-6 pb-6 space-y-5 border-t border-border/50">
                      <div className="pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Opis obligacji
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {proj.bond.description}
                        </p>
                        {proj.bond.notes && (
                          <p className="text-[11px] text-accent mt-1 font-medium">
                            ℹ {proj.bond.notes}
                          </p>
                        )}
                      </div>

                      {/* Year by year table */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Wartość rok do roku
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wider">
                                <th className="text-left px-3 py-2 font-medium">Rok</th>
                                <th className="text-right px-3 py-2 font-medium">Oprocentowanie</th>
                                <th className="text-right px-3 py-2 font-medium">Odsetki brutto</th>
                                <th className="text-right px-3 py-2 font-medium">Kara</th>
                                <th className="text-right px-3 py-2 font-medium">Wartość netto</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono divide-y divide-border">
                              {proj.yearly.map((pt) => (
                                <tr
                                  key={pt.year}
                                  className={cn(
                                    "transition-colors",
                                    pt.isEarlyRedemption
                                      ? "bg-warning/5"
                                      : "hover:bg-muted/20",
                                  )}
                                >
                                  <td className="px-3 py-1.5">
                                    <span className="font-sans text-[10px] font-bold text-muted-foreground">
                                      {pt.year}
                                    </span>
                                    {pt.isEarlyRedemption && (
                                      <AlertTriangle className="w-2.5 h-2.5 text-warning-foreground inline ml-1" />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right">
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5"
                                      style={{
                                        backgroundColor: `${color}18`,
                                        color,
                                      }}
                                    >
                                      <Percent className="w-2 h-2" />
                                      {pt.annualRatePct.toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-success text-[11px]">
                                    +{formatPLN2(pt.annualInterest)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-[11px]">
                                    {pt.penaltyApplied > 0 ? (
                                      <span className="text-destructive">
                                        -{formatPLN2(pt.penaltyApplied)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-bold text-[11px]">
                                    {formatPLN(pt.nominalValueNet)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Comparison summary */}
                      <div
                        className={cn(
                          "rounded-2xl p-4 border",
                          isBetter
                            ? "bg-success/5 border-success/20"
                            : "bg-destructive/5 border-destructive/20",
                        )}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">
                          Podsumowanie vs. Nieruchomość
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground text-[10px]">Obligacje CAGR netto</p>
                            <p className="font-bold font-mono" style={{ color }}>
                              {proj.irrAnnualNetPct.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Nieruchomość CAGR</p>
                            <p className="font-bold font-mono text-accent">
                              {realEstateIrrNet.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Różnica zysku</p>
                            <p
                              className={cn(
                                "font-bold font-mono",
                                isBetter ? "text-success" : "text-destructive",
                              )}
                            >
                              {isBetter ? "+" : ""}
                              {formatPLN(proj.totalNetInterest - (r.totalReturn > 0 ? r.totalReturn : 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Ryzyko</p>
                            <p className="font-bold text-success text-[11px]">
                              Gwarantowane
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {projections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Shield className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Wybierz co najmniej jedną obligację do analizy.
          </p>
        </div>
      )}

      {/* Key insight box */}
      <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-3">
        <h4 className="font-display text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Kluczowe wnioski
        </h4>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Najlepsza obligacja
            </p>
            <p
              className="font-display text-lg font-bold"
              style={{ color: BOND_COLORS[bestBond.bond.symbol] }}
            >
              {bestBond.bond.symbol}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {bestBond.irrAnnualNetPct.toFixed(1)}% CAGR netto
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Zalety obligacji
            </p>
            <ul className="space-y-1 text-muted-foreground leading-relaxed">
              <li>✓ Gwarancja Skarbu Państwa</li>
              <li>✓ Brak ryzyka pustostanu</li>
              <li>✓ Pełna płynność (z karą)</li>
            </ul>
          </div>
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Zalety nieruchomości
            </p>
            <ul className="space-y-1 text-muted-foreground leading-relaxed">
              <li>✓ Dźwignia finansowa (kredyt)</li>
              <li>✓ Ochrona przed CPI (real asset)</li>
              <li>✓ Możliwy cashflow co miesiąc</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic border-t border-border/50 pt-3">
          ⚠ Porównanie uproszczone. Nieruchomość uwzględnia dźwignię kredytową, ryzyko płynności i zarządzania.
          Obligacje zakładają reinwestycję odsetek w tym samym instrumencie lub rolowanie.
          Oprocentowanie obligacji na podstawie aktualnej oferty Ministerstwa Finansów (maj 2025).
        </p>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}