import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState } from "@/lib/store";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { monthlyPayment, loanTotalInterest, rentalCashflow } from "@/lib/finance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
  const total = investments.reduce((s, i) => s + i.value, 0);
  const monthly = investments.reduce((s, i) => s + i.monthlyContribution, 0);

  const [draft, setDraft] = useState({
    label: "",
    type: "ETF" as const,
    value: 0,
    monthlyContribution: 0,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl">Inwestycje</h2>
        <p className="text-sm text-muted-foreground">
          Łącznie {formatPLN(total)} · {formatPLN(monthly)}/m-c dopłat
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.label.trim() || draft.value <= 0) return;
          actions.addInvestment(draft);
          setDraft({ label: "", type: "ETF", value: 0, monthlyContribution: 0 });
        }}
        className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-card)] grid grid-cols-2 md:grid-cols-5 gap-2 items-end"
      >
        <Field label="Nazwa" className="col-span-2">
          <Input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="np. IKZE — VWCE"
            className="h-10"
          />
        </Field>
        <Field label="Typ">
          <Select
            value={draft.type}
            onValueChange={(v) => setDraft({ ...draft, type: v as typeof draft.type })}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Akcje", "ETF", "Obligacje", "Crypto", "Lokata", "Gotówka", "Inne"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Wartość">
          <Input
            type="number"
            value={draft.value || ""}
            onChange={(e) => setDraft({ ...draft, value: parseFloat(e.target.value) || 0 })}
            className="h-10 font-mono tabular-nums"
          />
        </Field>
        <Field label="Dopłata/m-c">
          <Input
            type="number"
            value={draft.monthlyContribution || ""}
            onChange={(e) =>
              setDraft({ ...draft, monthlyContribution: parseFloat(e.target.value) || 0 })
            }
            className="h-10 font-mono tabular-nums"
          />
        </Field>
        <Button type="submit" className="h-10 col-span-2 md:col-span-5">
          <Plus className="w-4 h-4 mr-1" /> Dodaj inwestycję
        </Button>
      </form>

      {investments.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nazwa</th>
                <th className="text-left px-4 py-3 font-medium">Typ</th>
                <th className="text-right px-4 py-3 font-medium">Wartość</th>
                <th className="text-right px-4 py-3 font-medium">Dopłata</th>
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
                      type="number"
                      value={i.value}
                      onChange={(e) =>
                        actions.updateInvestment(i.id, { value: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 text-right font-mono tabular-nums bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={i.monthlyContribution}
                      onChange={(e) =>
                        actions.updateInvestment(i.id, {
                          monthlyContribution: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 text-right font-mono tabular-nums bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                    {total > 0 ? ((i.value / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => actions.removeInvestment(i.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* LOANS */
function LoansSection() {
  const loans = useAppState((s) => s.loans);
  const totalDebt = loans.reduce((s, l) => s + l.principal, 0);
  const totalPmt = loans.reduce(
    (s, l) => s + monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining),
    0,
  );

  const [draft, setDraft] = useState({
    label: "",
    principal: 0,
    annualRatePct: 7.5,
    monthsRemaining: 240,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl">Kredyty</h2>
        <p className="text-sm text-muted-foreground">
          Łącznie {formatPLN(totalDebt)} · raty {formatPLN(totalPmt)}/m-c
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.label.trim() || draft.principal <= 0) return;
          actions.addLoan(draft);
          setDraft({ label: "", principal: 0, annualRatePct: 7.5, monthsRemaining: 240 });
        }}
        className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-card)] grid grid-cols-2 md:grid-cols-5 gap-2 items-end"
      >
        <Field label="Nazwa" className="col-span-2">
          <Input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="np. Hipoteka mieszkanie"
            className="h-10"
          />
        </Field>
        <Field label="Pozostały kapitał">
          <Input
            type="number"
            value={draft.principal || ""}
            onChange={(e) => setDraft({ ...draft, principal: parseFloat(e.target.value) || 0 })}
            className="h-10 font-mono tabular-nums"
          />
        </Field>
        <Field label="Oproc. rocznie %">
          <Input
            type="number"
            step="0.1"
            value={draft.annualRatePct}
            onChange={(e) =>
              setDraft({ ...draft, annualRatePct: parseFloat(e.target.value) || 0 })
            }
            className="h-10 font-mono tabular-nums"
          />
        </Field>
        <Field label="Pozostałe m-ce">
          <Input
            type="number"
            value={draft.monthsRemaining}
            onChange={(e) =>
              setDraft({ ...draft, monthsRemaining: parseInt(e.target.value) || 0 })
            }
            className="h-10 font-mono tabular-nums"
          />
        </Field>
        <Button type="submit" className="h-10 col-span-2 md:col-span-5">
          <Plus className="w-4 h-4 mr-1" /> Dodaj kredyt
        </Button>
      </form>

      {loans.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {loans.map((l) => {
            const pmt = monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining);
            const totalInt = loanTotalInterest(l.principal, l.annualRatePct, l.monthsRemaining);
            const yearsLeft = (l.monthsRemaining / 12).toFixed(1);
            return (
              <div
                key={l.id}
                className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Input
                    value={l.label}
                    onChange={(e) => actions.updateLoan(l.id, { label: e.target.value })}
                    className="font-display text-lg h-9 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none"
                  />
                  <button
                    onClick={() => actions.removeLoan(l.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Kapitał">
                    <Input
                      type="number"
                      value={l.principal}
                      onChange={(e) =>
                        actions.updateLoan(l.id, { principal: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Oproc. %">
                    <Input
                      type="number"
                      step="0.1"
                      value={l.annualRatePct}
                      onChange={(e) =>
                        actions.updateLoan(l.id, {
                          annualRatePct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                  <Field label="Pozostałe m-ce">
                    <Input
                      type="number"
                      value={l.monthsRemaining}
                      onChange={(e) =>
                        actions.updateLoan(l.id, {
                          monthsRemaining: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                  </Field>
                </div>

                <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Rata</p>
                    <p className="font-mono tabular-nums text-sm font-semibold">
                      {formatPLN2(pmt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Odsetki łącznie</p>
                    <p className="font-mono tabular-nums text-sm font-semibold text-destructive">
                      {formatPLN(totalInt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pozostało</p>
                    <p className="font-mono tabular-nums text-sm font-semibold">{yearsLeft} lat</p>
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

/* RENTALS */
function RentalsSection() {
  const rentals = useAppState((s) => s.rentals);
  const totalCashflow = rentals.reduce((s, r) => s + rentalCashflow(r).cashflow, 0);
  const totalValue = rentals.reduce((s, r) => s + r.marketValue, 0);

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
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl">Mieszkania na wynajem</h2>
        <p className="text-sm text-muted-foreground">
          {rentals.length} {rentals.length === 1 ? "mieszkanie" : "mieszkań"} · wartość{" "}
          {formatPLN(totalValue)} · cashflow {formatPLN(totalCashflow)}/m-c
        </p>
      </div>

      <form
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
        }}
        className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-card)] flex flex-wrap gap-2 items-end"
      >
        <Field label="Nazwa" className="flex-1 min-w-[200px]">
          <Input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="np. Kawalerka Mokotów"
            className="h-10"
          />
        </Field>
        <Field label="Czynsz">
          <Input
            type="number"
            value={draft.monthlyRent || ""}
            onChange={(e) => setDraft({ ...draft, monthlyRent: parseFloat(e.target.value) || 0 })}
            className="h-10 w-28 font-mono tabular-nums"
          />
        </Field>
        <Field label="Wartość rynkowa">
          <Input
            type="number"
            value={draft.marketValue || ""}
            onChange={(e) => setDraft({ ...draft, marketValue: parseFloat(e.target.value) || 0 })}
            className="h-10 w-32 font-mono tabular-nums"
          />
        </Field>
        <Button type="submit" className="h-10">
          <Plus className="w-4 h-4 mr-1" /> Dodaj
        </Button>
      </form>

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
