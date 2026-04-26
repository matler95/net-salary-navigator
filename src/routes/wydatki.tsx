import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState, type Expense } from "@/lib/store";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/wydatki")({
  head: () => ({
    meta: [
      { title: "Wydatki — Płaca.netto" },
      { name: "description", content: "Miesięczne wydatki gospodarstwa po kategoriach." },
    ],
  }),
  component: ExpensesPage,
});

const SUGGESTED_CATEGORIES = [
  "Mieszkanie",
  "Jedzenie",
  "Transport",
  "Zdrowie",
  "Dzieci",
  "Rozrywka",
  "Subskrypcje",
  "Oszczędności",
  "Inne",
];

function ExpensesPage() {
  const expenses = useAppState((s) => s.expenses);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const grouped = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach((e) => {
      if (!m.has(e.category)) m.set(e.category, []);
      m.get(e.category)!.push(e);
    });
    return Array.from(m, ([category, items]) => ({
      category,
      items,
      sum: items.reduce((s, x) => s + x.amount, 0),
    })).sort((a, b) => b.sum - a.sum);
  }, [expenses]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Wydatki miesięczne
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Suma: <span className="italic text-accent tabular-nums">{formatPLN(total)}</span>
          </h1>
        </div>
      </header>

      <AddExpenseForm />

      {grouped.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center text-muted-foreground border border-dashed border-border">
          Brak wydatków. Dodaj pierwszy powyżej.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {grouped.map((g) => (
            <div
              key={g.category}
              className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]"
            >
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-lg">{g.category}</h3>
                <p className="font-mono tabular-nums text-sm">
                  {formatPLN2(g.sum)}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({total > 0 ? ((g.sum / total) * 100).toFixed(0) : 0}%)
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                {g.items.map((e) => (
                  <ExpenseRow key={e.id} expense={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function AddExpenseForm() {
  const [category, setCategory] = useState("Mieszkanie");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim() || amount <= 0) return;
        actions.addExpense({ category: category.trim(), label: label.trim(), amount });
        setLabel("");
        setAmount(0);
      }}
      className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-card)] flex flex-wrap gap-2 items-end"
    >
      <div className="flex-1 min-w-[140px]">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Kategoria
        </label>
        <Input
          list="categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 h-10"
        />
        <datalist id="categories">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="flex-[2] min-w-[180px]">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Nazwa
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="np. Netflix, czynsz, paliwo"
          className="mt-1 h-10"
        />
      </div>
      <div className="w-32">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Kwota
        </label>
        <Input
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          min={0}
          className="mt-1 h-10 font-mono tabular-nums"
        />
      </div>
      <Button type="submit" className="h-10">
        <Plus className="w-4 h-4 mr-1" /> Dodaj
      </Button>
    </form>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={expense.label}
        onChange={(e) => actions.updateExpense(expense.id, { label: e.target.value })}
        className="h-9 flex-1 bg-transparent border-0 px-2 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
      />
      <Input
        type="number"
        value={expense.amount}
        onChange={(e) =>
          actions.updateExpense(expense.id, { amount: parseFloat(e.target.value) || 0 })
        }
        className="h-9 w-28 font-mono tabular-nums text-right bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
      />
      <button
        type="button"
        onClick={() => actions.removeExpense(expense.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
        aria-label="Usuń"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
