/**
 * Tiny global store with localStorage persistence + useSyncExternalStore subscription.
 * No external deps. SSR-safe (only touches localStorage in the browser).
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_SALARY_INPUTS, type SalaryInputs } from "./salary";
import type { Frequency } from "./finance";

export type Spouse = {
  id: string;
  name: string;
  inputs: SalaryInputs;
};

export type Expense = {
  id: string;
  category: string;
  label: string;
  amount: number;             // amount per occurrence
  frequency: Frequency;       // monthly | quarterly | semiannual | annual | oneoff
};

export type Investment = {
  id: string;
  label: string;
  type: "Akcje" | "ETF" | "Obligacje" | "Crypto" | "Lokata" | "Gotówka" | "Inne";
  value: number;        // current market value
  monthlyContribution: number;
};

export type Loan = {
  id: string;
  label: string;
  principal: number;            // remaining principal
  annualRatePct: number;
  monthsRemaining: number;
  monthlyOverpayment?: number;  // optional fixed extra payment / month
};

export type Rental = {
  id: string;
  label: string;
  monthlyRent: number;
  monthlyCosts: number;
  monthlyMortgage: number;
  vacancyRatePct: number;
  taxRatePct: number;       // 8.5 default
  marketValue: number;
};

export type AppState = {
  spouses: Spouse[];
  jointFiling: boolean;
  expenses: Expense[];
  investments: Investment[];
  loans: Loan[];
  rentals: Rental[];
};

const STORAGE_KEY = "placa-netto-state-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const DEFAULT_STATE: AppState = {
  spouses: [
    {
      id: uid(),
      name: "Małżonek 1",
      inputs: { ...DEFAULT_SALARY_INPUTS, gross: 12000 },
    },
  ],
  jointFiling: false,
  expenses: [
    { id: uid(), category: "Mieszkanie", label: "Czynsz administracyjny", amount: 800, frequency: "monthly" },
    { id: uid(), category: "Mieszkanie", label: "Media", amount: 600, frequency: "monthly" },
    { id: uid(), category: "Jedzenie", label: "Zakupy spożywcze", amount: 2000, frequency: "monthly" },
    { id: uid(), category: "Transport", label: "Paliwo / komunikacja", amount: 600, frequency: "monthly" },
    { id: uid(), category: "Ubezpieczenia", label: "OC + AC samochodu", amount: 1800, frequency: "annual" },
    { id: uid(), category: "Ubezpieczenia", label: "Ubezpieczenie mieszkania", amount: 400, frequency: "annual" },
  ],
  investments: [
    { id: uid(), label: "IKE — ETF S&P500", type: "ETF", value: 45000, monthlyContribution: 1000 },
  ],
  loans: [
    { id: uid(), label: "Kredyt hipoteczny", principal: 380000, annualRatePct: 7.5, monthsRemaining: 280, monthlyOverpayment: 0 },
  ],
  rentals: [],
};

let state: AppState = loadInitial();
const listeners = new Set<() => void>();

function loadInitial(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      spouses: parsed.spouses?.length
        ? parsed.spouses.map((s) => ({
            ...s,
            inputs: { ...DEFAULT_SALARY_INPUTS, ...s.inputs },
          }))
        : DEFAULT_STATE.spouses,
      expenses: parsed.expenses
        ? parsed.expenses.map((e) => ({ frequency: "monthly" as Frequency, ...e }))
        : DEFAULT_STATE.expenses,
      loans: parsed.loans
        ? parsed.loans.map((l) => ({ monthlyOverpayment: 0, ...l }))
        : DEFAULT_STATE.loans,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded — ignore */
  }
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => state;
const getServerSnapshot = () => DEFAULT_STATE;

export function useAppState<T>(selector: (s: AppState) => T): T {
  const full = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector(full);
}

export const actions = {
  // Spouses
  addSpouse() {
    setState((s) => ({
      ...s,
      spouses: [
        ...s.spouses,
        {
          id: uid(),
          name: `Małżonek ${s.spouses.length + 1}`,
          inputs: { ...DEFAULT_SALARY_INPUTS, gross: 8000 },
        },
      ],
    }));
  },
  removeSpouse(id: string) {
    setState((s) => ({
      ...s,
      spouses: s.spouses.length > 1 ? s.spouses.filter((sp) => sp.id !== id) : s.spouses,
      jointFiling: s.spouses.length - 1 < 2 ? false : s.jointFiling,
    }));
  },
  updateSpouse(id: string, patch: Partial<Spouse>) {
    setState((s) => ({
      ...s,
      spouses: s.spouses.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)),
    }));
  },
  updateSpouseInputs(id: string, patch: Partial<SalaryInputs>) {
    setState((s) => ({
      ...s,
      spouses: s.spouses.map((sp) =>
        sp.id === id ? { ...sp, inputs: { ...sp.inputs, ...patch } } : sp,
      ),
    }));
  },
  setJointFiling(v: boolean) {
    setState((s) => ({ ...s, jointFiling: v }));
  },

  // Expenses
  addExpense(e: Omit<Expense, "id">) {
    setState((s) => ({ ...s, expenses: [...s.expenses, { ...e, id: uid() }] }));
  },
  updateExpense(id: string, patch: Partial<Expense>) {
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },
  removeExpense(id: string) {
    setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== id) }));
  },

  // Investments
  addInvestment(e: Omit<Investment, "id">) {
    setState((s) => ({ ...s, investments: [...s.investments, { ...e, id: uid() }] }));
  },
  updateInvestment(id: string, patch: Partial<Investment>) {
    setState((s) => ({
      ...s,
      investments: s.investments.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },
  removeInvestment(id: string) {
    setState((s) => ({ ...s, investments: s.investments.filter((x) => x.id !== id) }));
  },

  // Loans
  addLoan(e: Omit<Loan, "id">) {
    setState((s) => ({ ...s, loans: [...s.loans, { ...e, id: uid() }] }));
  },
  updateLoan(id: string, patch: Partial<Loan>) {
    setState((s) => ({
      ...s,
      loans: s.loans.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },
  removeLoan(id: string) {
    setState((s) => ({ ...s, loans: s.loans.filter((x) => x.id !== id) }));
  },

  // Rentals
  addRental(e: Omit<Rental, "id">) {
    setState((s) => ({ ...s, rentals: [...s.rentals, { ...e, id: uid() }] }));
  },
  updateRental(id: string, patch: Partial<Rental>) {
    setState((s) => ({
      ...s,
      rentals: s.rentals.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },
  removeRental(id: string) {
    setState((s) => ({ ...s, rentals: s.rentals.filter((x) => x.id !== id) }));
  },

  reset() {
    setState(() => DEFAULT_STATE);
  },
};
