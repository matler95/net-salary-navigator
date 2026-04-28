import { createFileRoute } from "@tanstack/react-router";
import { actions, useAppState, type Expense } from "@/lib/store";
import { formatPLN, formatPLN2, parseLocaleAmount, formatLocaleAmount } from "@/lib/salary";
import {
  getExpenseAnnualTotal,
  getExpenseMonthlyAverage,
  FREQUENCY_LABELS,
  type Frequency,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
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
    () => expenses.reduce((s, e) => s + getExpenseMonthlyAverage(e), 0),
    [expenses],
  );
  const annualTotal = useMemo(
    () => expenses.reduce((s, e) => s + getExpenseAnnualTotal(e), 0),
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
      monthly: items.reduce((s, x) => s + getExpenseMonthlyAverage(x), 0),
      annual: items.reduce((s, x) => s + getExpenseAnnualTotal(x), 0),
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

function MonthSelector({
  selectedMonths,
  onChange,
  frequency,
}: {
  selectedMonths: number[];
  onChange: (months: number[]) => void;
  frequency: Frequency;
}) {
  const months = [
    { id: 1, label: "Sty" },
    { id: 2, label: "Lut" },
    { id: 3, label: "Mar" },
    { id: 4, label: "Kwi" },
    { id: 5, label: "Maj" },
    { id: 6, label: "Cze" },
    { id: 7, label: "Lip" },
    { id: 8, label: "Sie" },
    { id: 9, label: "Wrz" },
    { id: 10, label: "Paź" },
    { id: 11, label: "Lis" },
    { id: 12, label: "Gru" },
  ];

  const toggleMonth = (id: number) => {
    if (frequency === "oneoff" || frequency === "annual") {
      onChange([id]);
    } else {
      if (selectedMonths.includes(id)) {
        if (selectedMonths.length > 1) {
          onChange(selectedMonths.filter((m) => m !== id).sort((a, b) => a - b));
        }
      } else {
        onChange([...selectedMonths, id].sort((a, b) => a - b));
      }
    }
  };

  const setPreset = (preset: number[]) => onChange(preset);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {months.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggleMonth(m.id)}
            className={cn(
              "h-9 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center",
              selectedMonths.includes(m.id)
                ? "bg-accent text-accent-foreground border-accent shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-accent/30",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {frequency !== "oneoff" && frequency !== "annual" && frequency !== "monthly" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mr-1">
            Schematy:
          </span>
          {frequency === "bimonthly" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([1, 3, 5, 7, 9, 11])}
                className="h-6 px-2 text-[9px]"
              >
                Nieparzyste
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([2, 4, 6, 8, 10, 12])}
                className="h-6 px-2 text-[9px]"
              >
                Parzyste
              </Button>
            </>
          )}
          {frequency === "quarterly" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([1, 4, 7, 10])}
                className="h-6 px-2 text-[9px]"
              >
                I-IV-VII-X
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([2, 5, 8, 11])}
                className="h-6 px-2 text-[9px]"
              >
                II-V-VIII-XI
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([3, 6, 9, 12])}
                className="h-6 px-2 text-[9px]"
              >
                III-VI-IX-XII
              </Button>
            </>
          )}
          {frequency === "semiannual" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([1, 7])}
                className="h-6 px-2 text-[9px]"
              >
                Sty-Lip
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreset([6, 12])}
                className="h-6 px-2 text-[9px]"
              >
                Cze-Gru
              </Button>
            </>
          )}
        </div>
      )}
    </div>
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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  const handleReset = () => {
    setCategory("Mieszkanie");
    setIsCustomCategory(false);
    setLabel("");
    setAmount(0);
    setAmountInput("");
    setFrequency("monthly");
    setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  };

  const handleFrequencyChange = (f: Frequency) => {
    setFrequency(f);
    const m = new Date().getMonth() + 1;
    switch (f) {
      case "monthly":
        setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        break;
      case "bimonthly":
        setSelectedMonths([1, 3, 5, 7, 9, 11]);
        break;
      case "quarterly":
        setSelectedMonths([1, 4, 7, 10]);
        break;
      case "semiannual":
        setSelectedMonths([1, 7]);
        break;
      case "annual":
      case "oneoff":
        setSelectedMonths([m]);
        break;
    }
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
          <DialogDescription>
            Wprowadź dane nowego wydatku. Możesz wybrać kategorię, częstotliwość i konkretne miesiące płatności.
          </DialogDescription>
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
              months: selectedMonths,
              month: selectedMonths[0], // for compatibility
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
                  onBlur={() => setAmountInput(formatLocaleAmount(amount))}
                  placeholder="0"
                  className="mt-1 h-10 font-mono tabular-nums"
                />
              </div>
              
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Okres
                </label>
                <Select value={frequency} onValueChange={(v) => handleFrequencyChange(v as Frequency)}>
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

            {frequency !== "monthly" && (
              <div className="pt-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">
                  Miesiące płatności
                </label>
                <MonthSelector
                  frequency={frequency}
                  selectedMonths={selectedMonths}
                  onChange={setSelectedMonths}
                />
              </div>
            )}
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
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-1 group p-3 md:p-0">
      <div className="flex items-center gap-1 flex-1">
        <div className="flex-1 min-w-0">
          <Input
            value={expense.label}
            onChange={(e) => actions.updateExpense(expense.id, { label: e.target.value })}
            className="h-10 w-full bg-transparent border-0 px-2 hover:bg-muted/50 focus-visible:ring-1 shadow-none truncate"
          />
        </div>
        <Input
          type="text"
          inputMode="decimal"
          value={formatLocaleAmount(expense.amount)}
          onChange={(e) =>
            actions.updateExpense(expense.id, { amount: parseLocaleAmount(e.target.value) })
          }
          placeholder="0"
          className="h-10 w-24 font-mono tabular-nums text-right bg-transparent border-0 hover:bg-muted/50 focus-visible:ring-1 shadow-none shrink-0"
        />
      </div>

      <div className="flex items-center gap-1 justify-between md:justify-end">
        <div className="flex items-center gap-1">
          <Select
            value={expense.frequency}
            onValueChange={(v) => {
              const f = v as Frequency;
              const patch: Partial<Expense> = { frequency: f };
              const m = new Date().getMonth() + 1;
              switch (f) {
                case "monthly":
                  patch.months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                  break;
                case "bimonthly":
                  patch.months = [1, 3, 5, 7, 9, 11];
                  break;
                case "quarterly":
                  patch.months = [1, 4, 7, 10];
                  break;
                case "semiannual":
                  patch.months = [1, 7];
                  break;
                case "annual":
                case "oneoff":
                  patch.months = [expense.month ?? m];
                  break;
              }
              actions.updateExpense(expense.id, patch);
            }}
          >
            <SelectTrigger className="h-10 w-[110px] bg-transparent border-0 hover:bg-muted/50 shadow-none text-xs">
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

          {expense.frequency !== "monthly" && (
            <Dialog>
              <DialogTrigger asChild>
                <button className="h-10 px-2 flex flex-col items-center justify-center bg-transparent border-0 hover:bg-muted/50 shadow-none min-w-[50px]">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground/70 leading-none mb-1">
                    M-ce
                  </span>
                  <span className="text-[10px] font-mono font-bold text-accent leading-none">
                    {expense.months?.length || 1}x
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Miesiące płatności</DialogTitle>
                  <DialogDescription>
                    Wybierz miesiące, w których ten wydatek jest opłacany.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <MonthSelector
                    frequency={expense.frequency}
                    selectedMonths={
                      expense.months || (expense.month ? [expense.month] : [1])
                    }
                    onChange={(m) => actions.updateExpense(expense.id, { months: m, month: m[0] })}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex items-center gap-2">
          {expense.frequency !== "monthly" && (
            <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right whitespace-nowrap">
              ≈ {formatPLN(getExpenseMonthlyAverage(expense))}/m
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
            className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive p-2 transition-opacity"
            aria-label={`Usuń: ${expense.label}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

