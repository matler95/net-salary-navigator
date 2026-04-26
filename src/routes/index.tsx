import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
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
} from "recharts";
import { useAppState } from "@/lib/store";
import { calculateSalary, computeJointFiling, formatPLN, formatPLN2 } from "@/lib/salary";
import { rentalCashflow, monthlyPayment, toMonthly } from "@/lib/finance";
import { convertToPLN, useDailyFxRates } from "@/lib/fx";

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

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning-foreground"
          : "";
  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`font-display text-3xl mt-1.5 tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Dashboard() {
  const spouses = useAppState((s) => s.spouses);
  const jointFiling = useAppState((s) => s.jointFiling);
  const expenses = useAppState((s) => s.expenses);
  const investments = useAppState((s) => s.investments);
  const loans = useAppState((s) => s.loans);
  const rentals = useAppState((s) => s.rentals);
  const { rates } = useDailyFxRates();

  const breakdowns = useMemo(
    () => spouses.map((s) => ({ spouse: s, r: calculateSalary(s.inputs) })),
    [spouses],
  );

  const totalNet = breakdowns.reduce((sum, { r }) => sum + r.net, 0);
  const totalGross = breakdowns.reduce((sum, { r }) => sum + r.gross, 0);
  const totalExpenses = expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const totalInvestments = investments.reduce(
    (s, i) => s + convertToPLN(i.value, i.currency, rates),
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

  const cashflow = totalNet + rentalNet - totalExpenses - monthlyLoanPmt;
  const netWorth = totalInvestments + rentalAssets - totalLoans;

  // Joint filing comparison
  const joint = spouses.length === 2 ? computeJointFiling(breakdowns[0].r, breakdowns[1].r) : null;

  // Expense breakdown by category
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) =>
      map.set(e.category, (map.get(e.category) || 0) + toMonthly(e.amount, e.frequency)),
    );
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [expenses]);

  // Threshold projection
  const projection = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const point: Record<string, number | string> = { month: monthLabel(month) };
      breakdowns.forEach(({ spouse, r }) => {
        point[spouse.name] = Math.round(r.taxBase * month);
      });
      return point;
    });
  }, [breakdowns]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
          Pulpit gospodarstwa
        </p>
        <h1 className="font-display text-4xl sm:text-5xl">
          {greeting()}, <span className="italic text-accent">jak idą finanse?</span>
        </h1>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Netto miesięcznie"
          value={formatPLN(totalNet)}
          sub={`${spouses.length} ${spouses.length === 1 ? "osoba" : "osoby"} · brutto ${formatPLN(totalGross)}`}
          tone="success"
        />
        <Stat
          label="Wydatki"
          value={formatPLN(totalExpenses + monthlyLoanPmt)}
          sub={`w tym kredyty ${formatPLN(monthlyLoanPmt)}`}
          tone="destructive"
        />
        <Stat
          label="Cashflow / m-c"
          value={formatPLN(cashflow)}
          sub={cashflow >= 0 ? "nadwyżka" : "deficyt"}
          tone={cashflow >= 0 ? "success" : "destructive"}
        />
        <Stat
          label="Majątek netto"
          value={formatPLN(netWorth)}
          sub={`aktywa ${formatPLN(totalInvestments + rentalAssets)} · długi ${formatPLN(totalLoans)}`}
        />
      </section>

      {/* Joint vs individual filing */}
      {joint && (
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
      )}

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
          desc={`${investments.length + rentals.length} aktywów · ${loans.length} kredytów`}
        />
      </section>
    </main>
  );
}

function QuickCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <a
      href={to}
      className="group bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)] hover:border-accent/50 transition-colors"
    >
      <p className="font-display text-lg group-hover:text-accent transition-colors">{title} →</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </a>
  );
}

function monthLabel(m: number) {
  return ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"][
    m - 1
  ];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Dzień dobry";
  if (h < 18) return "Cześć";
  return "Dobry wieczór";
}
