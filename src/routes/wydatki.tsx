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
import { EmptyState } from "@/components/ui/empty-state";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Trash2, Plus, RotateCcw, Home, UtensilsCrossed, Car, ShieldPlus, HeartPulse, Baby, MonitorPlay, Repeat, Wallet, ListPlus, ShoppingBag, Pencil } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/wydatki")({
  head: () => ({
    meta: [
      { title: "Wydatki - Saldeo" },
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

const CATEGORY_COLORS = [
  "var(--accent)",
  "oklch(0.62 0.14 148)",
  "oklch(0.74 0.13 75)",
  "oklch(0.58 0.19 25)",
  "oklch(0.52 0.018 210)",
  "oklch(0.80 0.12 180)",
];

function getCategoryColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function getCategoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("mieszkanie") || n.includes("dom") || n.includes("czynsz")) return Home;
  if (n.includes("jedzenie") || n.includes("zakupy") || n.includes("restauracja")) return UtensilsCrossed;
  if (n.includes("transport") || n.includes("auto") || n.includes("paliwo") || n.includes("bilet")) return Car;
  if (n.includes("ubezpieczeni") || n.includes("oc") || n.includes("ac")) return ShieldPlus;
  if (n.includes("zdrowie") || n.includes("lekarz") || n.includes("leki")) return HeartPulse;
  if (n.includes("dzieci") || n.includes("szkoła") || n.includes("przedszkole")) return Baby;
  if (n.includes("rozrywka") || n.includes("kino") || n.includes("wyjścia") || n.includes("wakacje")) return MonitorPlay;
  if (n.includes("subskrypcj") || n.includes("netflix") || n.includes("spotify")) return Repeat;
  return Wallet;
}

function ExpensesPage() {
  const expenses = useAppState((s) => s.expenses);

  const monthlyTotal = useMemo(() => expenses.reduce((s, e) => s + getExpenseMonthlyAverage(e), 0), [expenses]);
  const annualTotal = useMemo(() => expenses.reduce((s, e) => s + getExpenseAnnualTotal(e), 0), [expenses]);
  const oneoffTotal = useMemo(() => expenses.filter((e) => e.frequency === "oneoff").reduce((s, e) => s + e.amount, 0), [expenses]);

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
            Wydatki (mies.)
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Gdzie uciekają <span className="italic text-accent">pieniądze?</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Śledź swoje stałe i zmienne koszty życia. Kategoryzacja pozwala Saldeo na stworzenie lepszej projekcji budżetu i znalezienie potencjalnych oszczędności.
          </p>
          <div className="flex items-baseline gap-4 mt-6">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-4xl tabular-nums animate-count-up">
                {formatPLN(monthlyTotal).replace(" zł", "")}
              </span>
              <span className="text-sm text-muted-foreground font-bold uppercase tracking-wider">zł / m-c</span>
            </div>
            <div className="h-8 w-px bg-border mx-2" />
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              Rocznie: <span className="font-mono tabular-nums bg-muted px-2 py-0.5 rounded-md text-foreground">{formatPLN(annualTotal)}</span>
              {oneoffTotal > 0 && (
                <>
                  <span className="opacity-50">•</span>
                  <span>Jednorazowe: <span className="font-mono tabular-nums text-foreground">{formatPLN(oneoffTotal)}</span></span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AddExpenseDialog />
        </div>
      </header>

      {grouped.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Jeszcze nie śledzisz wydatków"
          description="Zacznij od największych kategorii - czynsz, jedzenie, transport. Im więcej dodasz, tym dokładniejsza będzie projekcja budżetu domowego."
          className="my-12 max-w-2xl mx-auto"
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 animate-fade-up">
          {grouped.map((g) => {
            const Icon = getCategoryIcon(g.category);
            const color = getCategoryColor(g.category);
            const pct = monthlyTotal > 0 ? ((g.monthly / monthlyTotal) * 100) : 0;

            return (
              <div
                key={g.category}
                className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-card relative overflow-hidden"
              >
                {/* Accent border left */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80"
                  style={{ backgroundColor: color }}
                />

                <div className="flex items-start justify-between mb-5 gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold leading-none">{g.category}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground font-medium">{formatPLN(g.annual)} / rok</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl tabular-nums leading-none mb-1">
                      {formatPLN2(g.monthly)}
                    </p>
                    <span
                      className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
                    >
                      {pct.toFixed(0)}% sumy
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {g.items.map((e) => (
                    <ExpenseRow key={e.id} expense={e} color={color} />
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                  <AddExpenseDialog defaultCategory={g.category} variant="ghost" />
                </div>
              </div>
            );
          })}
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
    { id: 1, label: "Sty" }, { id: 2, label: "Lut" }, { id: 3, label: "Mar" },
    { id: 4, label: "Kwi" }, { id: 5, label: "Maj" }, { id: 6, label: "Cze" },
    { id: 7, label: "Lip" }, { id: 8, label: "Sie" }, { id: 9, label: "Wrz" },
    { id: 10, label: "Paź" }, { id: 11, label: "Lis" }, { id: 12, label: "Gru" },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {frequency === "oneoff" || frequency === "annual" ? "Wybierz miesiąc" : "Zaznacz miesiące"}
        </span>
        {frequency !== "oneoff" && frequency !== "annual" && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])} className="text-[10px] text-accent hover:underline font-semibold">Wszystkie</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {months.map((m) => {
          const isSelected = selectedMonths.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMonth(m.id)}
              className={cn(
                "h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center border",
                isSelected
                  ? "bg-accent-gradient text-accent-foreground border-transparent shadow-card"
                  : "bg-card text-foreground border-border hover:border-accent/40"
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {frequency !== "oneoff" && frequency !== "annual" && frequency !== "monthly" && (
        <div className="flex flex-wrap gap-2 pt-2">
          {frequency === "bimonthly" && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([1, 3, 5, 7, 9, 11])} className="h-7 text-[10px] rounded-full px-3">Nieparzyste</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([2, 4, 6, 8, 10, 12])} className="h-7 text-[10px] rounded-full px-3">Parzyste</Button>
            </>
          )}
          {frequency === "quarterly" && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([1, 4, 7, 10])} className="h-7 text-[10px] rounded-full px-3">I-IV-VII-X</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([2, 5, 8, 11])} className="h-7 text-[10px] rounded-full px-3">II-V-VIII-XI</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([3, 6, 9, 12])} className="h-7 text-[10px] rounded-full px-3">III-VI-IX-XII</Button>
            </>
          )}
          {frequency === "semiannual" && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([1, 7])} className="h-7 text-[10px] rounded-full px-3">Sty-Lip</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPreset([6, 12])} className="h-7 text-[10px] rounded-full px-3">Cze-Gru</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({
  initialData,
  onSave,
  onCancel,
  submitLabel = "Zapisz wydatek",
  title = "Nowy wydatek",
  description = "Kategoryzacja wydatków pozwala Saldeo na stworzenie lepszej projekcji rocznej."
}: {
  initialData?: Partial<Expense>,
  onSave: (data: any) => void,
  onCancel: () => void,
  submitLabel?: string,
  title?: string,
  description?: string
}) {
  const [category, setCategory] = useState(initialData?.category || "Mieszkanie");
  const [isCustomCategory, setIsCustomCategory] = useState(
    initialData?.category ? !SUGGESTED_CATEGORIES.includes(initialData.category) : false
  );
  const [label, setLabel] = useState(initialData?.label || "");
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [amountInput, setAmountInput] = useState(initialData?.amount ? formatLocaleAmount(initialData.amount) : "");
  const [frequency, setFrequency] = useState<Frequency>(initialData?.frequency || "monthly");
  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    initialData?.months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  );

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

  const currentPreview = amount > 0
    ? (frequency === "monthly" ? amount : (amount * selectedMonths.length / 12))
    : 0;

  return (
    <div className="p-6 sm:p-8">
      <DialogHeader className="mb-6">
        <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsedAmount = parseLocaleAmount(amountInput);
          if (!label.trim() || parsedAmount <= 0) return;
          onSave({
            category: isCustomCategory ? category.trim() || "Inne" : category,
            label: label.trim(),
            amount: parsedAmount,
            frequency,
            months: selectedMonths,
            month: selectedMonths[0],
          });
        }}
        className="space-y-6"
      >
        {/* Step 1: Category and Name */}
        <div className="bg-muted/30 p-4 rounded-2xl border border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                Kategoria
              </label>
              {isCustomCategory ? (
                <div className="relative">
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 pr-8 bg-card"
                    autoFocus
                    placeholder="Wpisz własną..."
                  />
                  <button
                    type="button"
                    onClick={() => { setIsCustomCategory(false); setCategory("Mieszkanie"); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Select
                  value={category}
                  onValueChange={(v) => {
                    if (v === "__custom__") { setIsCustomCategory(true); setCategory(""); }
                    else { setCategory(v); }
                  }}
                >
                  <SelectTrigger className="h-11 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUGGESTED_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="font-medium text-accent">+ Własna kategoria</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
                Nazwa
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="np. Prąd, Netflix"
                className="h-11 bg-card"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Amount and Frequency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
              Kwota pojedynczej płatności
            </label>
            <div className="relative">
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
                className="h-12 font-mono tabular-nums text-lg font-bold pr-12 bg-card border-accent/20 focus-visible:ring-accent"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">zł</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">
              Częstotliwość
            </label>
            <Select value={frequency} onValueChange={(v) => handleFrequencyChange(v as Frequency)}>
              <SelectTrigger className="h-12 bg-card font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Step 3: Months (if applicable) */}
        {frequency !== "monthly" && (
          <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
            <MonthSelector
              frequency={frequency}
              selectedMonths={selectedMonths}
              onChange={setSelectedMonths}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-border mt-6">
          <div className="mb-4 sm:mb-0 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Średnie obciążenie
            </p>
            <p className="font-display text-xl font-bold tabular-nums text-foreground">
              {formatPLN(currentPreview)} <span className="text-sm font-sans font-normal text-muted-foreground">/ m-c</span>
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none h-12 rounded-full px-6 font-bold">
              Anuluj
            </Button>
            <Button
              type="submit"
              className="flex-1 sm:w-auto h-12 rounded-full px-8 bg-accent-gradient text-accent-foreground shadow-warm font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-transform"
              disabled={amount <= 0 || !label.trim() || selectedMonths.length === 0}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AddExpenseDialog({ defaultCategory, variant = "default" }: { defaultCategory?: string; variant?: "default" | "ghost" }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "default" ? (
          <Button className="h-12 sm:h-11 rounded-full px-6 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 font-bold">
            <ListPlus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Dodaj wydatek</span>
          </Button>
        ) : (
          <button className="text-[10px] uppercase tracking-wider font-bold text-accent hover:underline flex items-center gap-1.5 transition-all">
            <ListPlus className="w-3.5 h-3.5" />
            Dodaj do tej kategorii
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl p-0 rounded-2xl overflow-hidden">
        <ExpenseForm
          initialData={defaultCategory ? { category: defaultCategory } : undefined}
          onSave={(data) => {
            actions.addExpense(data);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditExpenseDialog({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-accent p-2 transition-colors rounded-lg hover:bg-accent/10"
          aria-label={`Edytuj: ${expense.label}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl p-0 rounded-2xl overflow-hidden">
        <ExpenseForm
          initialData={expense}
          title="Edytuj wydatek"
          submitLabel="Zapisz zmiany"
          onSave={(data) => {
            actions.updateExpense(expense.id, data);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExpenseRow({ expense, color }: { expense: Expense; color: string }) {
  return (
    <div className="group flex flex-col md:flex-row md:items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Input
          value={expense.label}
          onChange={(e) => actions.updateExpense(expense.id, { label: e.target.value })}
          className="h-10 w-full bg-transparent border-0 px-1 font-semibold hover:bg-muted focus-visible:ring-1 shadow-none truncate"
        />
        {expense.frequency !== "monthly" && (
          <span
            className="shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-border bg-card text-muted-foreground"
          >
            {FREQUENCY_LABELS[expense.frequency].replace('Co ', '')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 pl-1 md:pl-0">
        {/* Months dots if not monthly */}
        {expense.frequency !== "monthly" && (
          <div className="flex flex-wrap gap-0.5 w-16 opacity-70">
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              const isActive = expense.months?.includes(m) || expense.month === m;
              return (
                <div
                  key={m}
                  className={cn("w-1.5 h-1.5 rounded-full", isActive ? "opacity-100" : "bg-muted-foreground/20")}
                  style={{ backgroundColor: isActive ? color : undefined }}
                  title={["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"][i]}
                />
              );
            })}
          </div>
        )}

        <Input
          type="text"
          inputMode="decimal"
          value={formatLocaleAmount(expense.amount)}
          onChange={(e) =>
            actions.updateExpense(expense.id, { amount: parseLocaleAmount(e.target.value) })
          }
          placeholder="0"
          className="h-10 w-24 font-mono tabular-nums text-right bg-transparent border-0 font-bold hover:bg-muted focus-visible:ring-1 shadow-none shrink-0"
        />

        <div className="flex items-center gap-1 border-l border-border pl-3">
          <EditExpenseDialog expense={expense} />
          <button
            type="button"
            onClick={() => {
              const expenseCopy = { ...expense };
              actions.removeExpense(expense.id);
              toast(`Usunięto "${expense.label}"`, {
                action: {
                  label: "Cofnij",
                  onClick: () => {
                    const { id, ...rest } = expenseCopy;
                    actions.addExpense(rest as any);
                  },
                },
              });
            }}
            className="text-muted-foreground hover:text-destructive p-2 transition-colors rounded-lg hover:bg-destructive/10"
            aria-label={`Usuń: ${expense.label}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
