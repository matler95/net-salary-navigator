import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState, type Expense } from "@/lib/store";
import { formatPLN, formatPLN2, parseLocaleAmount } from "@/lib/salary";
import { toMonthly, toAnnual, FREQUENCY_LABELS, type Frequency } from "@/lib/finance";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/wydatki")({
  head: () => ({
    meta: [
      { title: "Wydatki — Płaca.netto" },
      {
        name: "description",
        content:
          "Wydatki gospodarstwa po kategoriach z różnymi okresami: miesięcznie, co 2 miesiące, kwartalnie, rocznie, jednorazowo.",
      },
    ],
  }),
  component: ExpensesPage,
});

const SUGGESTED_CATEGORIES = [
  "Mieszkanie",
  "Jedzenie",
  "Transport",
  "Ubezpieczenia",
  "Zdrowie",
  "Dzieci",
  "Rozrywka",
  "Subskrypcje",
  "Osobiste",
  "Inne",
];

const FREQUENCIES: Frequency[] = [
  "monthly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "annual",
  "oneoff",
];

function ExpensesPage() {
  const expenses = useAppState((s) => s.expenses);

  const monthlyTotal = useMemo(
    () => expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0),
    [expenses],
  );
  const annualTotal = useMemo(
    () => expenses.reduce((s, e) => s + toAnnual(e.amount, e.frequency), 0),
    [expenses],
  );
  const oneoffTotal = useMemo(
    () => expenses.filter((e) => e.frequency === "oneoff").reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach((e) => {
      if (!m.has(e.category)) m.set(e.category, []);
      m.get(e.category)!.push(e);
    });
    return Array.from(m, ([category, items]) => ({
      category,
      items,
      monthly: items.reduce((s, x) => s + toMonthly(x.amount, x.frequency), 0),
      annual: items.reduce((s, x) => s + toAnnual(x.amount, x.frequency), 0),
    })).sort((a, b) => b.annual - a.annual);
  }, [expenses]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Wydatki
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            <span className="italic text-accent tabular-nums">{formatPLN(monthlyTotal)}</span>{" "}
            <span className="text-muted-foreground text-2xl sm:text-3xl">/ m-c</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Rocznie: <span className="font-mono tabular-nums">{formatPLN(annualTotal)}</span>
            {oneoffTotal > 0 && (
              <>
                {" "}
                · w tym jednorazowe:{" "}
                <span className="font-mono tabular-nums">{formatPLN(oneoffTotal)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddExpenseDialog />
        </div>
      </header>

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
              <div className="flex items-baseline justify-between mb-3 gap-2">
                <h3 className="font-display text-lg">{g.category}</h3>
                <div className="text-right">
                  <p className="font-mono tabular-nums text-sm">
                    {formatPLN2(g.monthly)}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({monthlyTotal > 0 ? ((g.monthly / monthlyTotal) * 100).toFixed(0) : 0}%)
                    </span>
                  </p>
                  <p className="font-mono tabular-nums text-xs text-muted-foreground">
                    {formatPLN(g.annual)} / rok
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
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

function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("Mieszkanie");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");

  const handleReset = () => {
    setCategory("Mieszkanie");
    setIsCustomCategory(false);
    setLabel("");
    setAmount(0);
    setAmountInput("");
    setFrequency("monthly");
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
          Dodaj wydatek
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Dodaj wydatek</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsedAmount = parseLocaleAmount(amountInput);
            if (!label.trim() || parsedAmount <= 0) return;
            actions.addExpense({
              category: isCustomCategory ? category.trim() || "Inne" : category,
              label: label.trim(),
              amount: parsedAmount,
              frequency,
            });
            handleReset();
            setOpen(false);
          }}
          className="grid gap-4 py-4"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Kategoria
              </label>
              {isCustomCategory ? (
                <div className="relative mt-1">
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 pr-8"
                    autoFocus
                    placeholder="Wpisz własną..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setCategory("Mieszkanie");
                    }}
                    aria-label="Anuluj własną kategorię"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Select
                  value={category}
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setIsCustomCategory(true);
                      setCategory("");
                    } else {
                      setCategory(v);
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUGGESTED_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="font-medium text-accent">
                      + Własna...
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Nazwa
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="np. OC samochodu, Netflix, czynsz"
                className="mt-1 h-10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Kwota
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setAmount(parseLocaleAmount(e.target.value));
                  }}
                  onBlur={() => setAmountInput(formatAmountInput(amount))}
                  min={0}
                  className="mt-1 h-10 font-mono tabular-nums"
                />
              </div>
              
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Okres
                </label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger className="mt-1 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Zapisz wydatek</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const monthly = toMonthly(expense.amount, expense.frequency);
  return (
    <div className="flex items-center gap-1 group">
      <Input
        value={expense.label}
        onChange={(e) => actions.updateExpense(expense.id, { label: e.target.value })}
        className="h-10 flex-1 bg-transparent border-0 px-2 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
      />
      <Input
        type="text"
        inputMode="decimal"
        value={formatAmountInput(expense.amount)}
        onChange={(e) =>
          actions.updateExpense(expense.id, { amount: parseLocaleAmount(e.target.value) })
        }
        className="h-10 w-24 font-mono tabular-nums text-right bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none"
      />
      <Select
        value={expense.frequency}
        onValueChange={(v) => actions.updateExpense(expense.id, { frequency: v as Frequency })}
      >
        <SelectTrigger className="h-10 w-[130px] bg-transparent border-0 hover:bg-muted/50 shadow-none text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map((f) => (
            <SelectItem key={f} value={f} className="text-xs">
              {FREQUENCY_LABELS[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {expense.frequency !== "monthly" && expense.frequency !== "oneoff" && (
        <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
          ≈ {formatPLN(monthly)}/m
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          const expenseCopy = { ...expense };
          actions.removeExpense(expense.id);
          toast(`"${expense.label}" usunięto`, {
            action: {
              label: "Cofnij",
              onClick: () => {
                const { id, ...rest } = expenseCopy;
                actions.addExpense(rest as any);
              },
            },
            duration: 5000,
          });
        }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
        aria-label={`Usuń: ${expense.label}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function formatAmountInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(2).replace(/\.00$/, "").replace(".", ",");
}
