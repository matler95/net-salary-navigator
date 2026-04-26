/**
 * Tiny global store with localStorage persistence + useSyncExternalStore subscription.
 * No external deps. SSR-safe (only touches localStorage in the browser).
 */

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { DEFAULT_SALARY_INPUTS, type SalaryInputs } from "./salary";
import type { Frequency } from "./finance";
import type { InvestmentCurrency } from "./fx";
import {
  acceptHouseholdInvite,
  createHouseholdInvite,
  ensureHouseholdForSession,
  loadHouseholdState,
  saveHouseholdState,
} from "./repository";
import { migrateLocalToCloudOnce } from "./migration";

export type Spouse = {
  id: string;
  name: string;
  inputs: SalaryInputs;
};

export type Expense = {
  id: string;
  category: string;
  label: string;
  amount: number; // amount per occurrence
  frequency: Frequency; // monthly | quarterly | semiannual | annual | oneoff
  month?: number; // 1-12, used for oneoff and annual planning
};

export type Investment = {
  id: string;
  label: string;
  type: "Akcje" | "ETF" | "Obligacje" | "Crypto" | "Lokata" | "Gotówka" | "Inne";
  currency: InvestmentCurrency;
  ticker?: string;
  volume?: number;
  tickerPriceAtAdd?: number;
  tickerPriceDate?: string;
  value: number; // legacy/manual base value fallback
  monthlyContribution: number;
};

export type Loan = {
  id: string;
  label: string;
  principal: number; // remaining principal
  annualRatePct: number;
  monthsRemaining: number;
  monthlyOverpayment?: number; // optional fixed extra payment / month
  paymentDayOfMonth?: number; // day of month (1-31) when payment is made
  lastPaymentDate?: string; // ISO date of last payment
};

export type Rental = {
  id: string;
  label: string;
  monthlyRent: number;
  monthlyCosts: number;
  monthlyMortgage: number;
  vacancyRatePct: number;
  taxRatePct: number; // 8.5 default
  marketValue: number;
};

export type SavingsAccountType = "zwykłe" | "oszczędnościowe" | "lokata";

export type SavingsAccount = {
  id: string;
  bank: string;
  type: SavingsAccountType;
  balance: number; // current balance / lokata principal
  ratePct: number; // annual interest rate %, 0 if not applicable
  // Lokata-specific
  lokataStartDate?: string; // ISO date
  lokataDurationMonths?: number;
  lokataCapitalization?: "miesięczna" | "kwartalna" | "roczna" | "na końcu";
};

export type GlobalSettings = {
  avgSalaryForecast: number;
  pitThresholdAnnual: number;
  pitFirstRate: number; // in %
  pitSecondRate: number; // in %
  taxFreeAmountAnnual: number;
};

export type AppState = {
  spouses: Spouse[];
  jointFiling: boolean;
  expenses: Expense[];
  investments: Investment[];
  loans: Loan[];
  rentals: Rental[];
  savings: SavingsAccount[];
  globalSettings: GlobalSettings;
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
    {
      id: uid(),
      category: "Mieszkanie",
      label: "Czynsz administracyjny",
      amount: 800,
      frequency: "monthly",
    },
    { id: uid(), category: "Mieszkanie", label: "Media", amount: 600, frequency: "monthly" },
    {
      id: uid(),
      category: "Jedzenie",
      label: "Zakupy spożywcze",
      amount: 2000,
      frequency: "monthly",
    },
    {
      id: uid(),
      category: "Transport",
      label: "Paliwo / komunikacja",
      amount: 600,
      frequency: "monthly",
    },
    {
      id: uid(),
      category: "Ubezpieczenia",
      label: "OC + AC samochodu",
      amount: 1800,
      frequency: "annual",
    },
    {
      id: uid(),
      category: "Ubezpieczenia",
      label: "Ubezpieczenie mieszkania",
      amount: 400,
      frequency: "annual",
    },
  ],
  investments: [
    {
      id: uid(),
      label: "IKE — ETF S&P500",
      type: "ETF",
      currency: "PLN",
      ticker: "",
      volume: 0,
      tickerPriceAtAdd: 0,
      tickerPriceDate: "",
      value: 45000,
      monthlyContribution: 1000,
    },
  ],
  loans: [
    {
      id: uid(),
      label: "Kredyt hipoteczny",
      principal: 380000,
      annualRatePct: 7.5,
      monthsRemaining: 280,
      monthlyOverpayment: 0,
    },
  ],
  rentals: [],
  savings: [],
  globalSettings: {
    avgSalaryForecast: 8673, // 2025
    pitThresholdAnnual: 120000,
    pitFirstRate: 12,
    pitSecondRate: 32,
    taxFreeAmountAnnual: 30000,
  },
};

let state: AppState = loadInitial();
const listeners = new Set<() => void>();
let cloudSyncEnabled = false;
let activeHouseholdId: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInProgress = false;

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
        ? parsed.expenses.map((e) => ({ ...e, frequency: e.frequency ?? "monthly" }))
        : DEFAULT_STATE.expenses,
      investments: parsed.investments
        ? parsed.investments.map((i) => ({
            ...i,
            currency: i.currency ?? "PLN",
            ticker: i.ticker ?? "",
            volume: i.volume ?? 0,
            tickerPriceAtAdd: i.tickerPriceAtAdd ?? 0,
            tickerPriceDate: i.tickerPriceDate ?? "",
          }))
        : DEFAULT_STATE.investments,
      loans: parsed.loans
        ? parsed.loans.map((l) => ({ ...l, monthlyOverpayment: l.monthlyOverpayment ?? 0 }))
        : DEFAULT_STATE.loans,
      savings: parsed.savings
        ? parsed.savings.map((a) => ({ ...a, ratePct: (a as any).ratePct ?? 0 }))
        : DEFAULT_STATE.savings,
      globalSettings: parsed.globalSettings 
        ? { ...DEFAULT_STATE.globalSettings, ...parsed.globalSettings }
        : DEFAULT_STATE.globalSettings,
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
  scheduleCloudSync();
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

export async function initCloudSync(session: Session | null) {
  if (!session) {
    cloudSyncEnabled = false;
    activeHouseholdId = null;
    return;
  }
  // Prevent concurrent initialisations from racing
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    const household = await ensureHouseholdForSession(session);
    // `return` inside try still triggers finally, so syncInProgress resets correctly
    if (!household?.householdId) return;
    activeHouseholdId = household.householdId;
    cloudSyncEnabled = true;
    await migrateLocalToCloudOnce(household.householdId, state);
    const cloudState = await loadHouseholdState(household.householdId);
    state = {
      ...state,
      spouses: cloudState.spouses?.length ? cloudState.spouses : state.spouses,
      expenses: cloudState.expenses ?? state.expenses,
      investments: cloudState.investments ?? state.investments,
      loans: cloudState.loans ?? state.loans,
      rentals: cloudState.rentals ?? state.rentals,
      savings: cloudState.savings ?? state.savings,
      jointFiling: cloudState.jointFiling ?? state.jointFiling,
      globalSettings: cloudState.globalSettings ?? state.globalSettings,
    };
    persist();
    listeners.forEach((l) => l());
  } finally {
    syncInProgress = false;
  }
}

export async function createInvite(email: string): Promise<string | null> {
  if (!activeHouseholdId) return null;
  const invite = await createHouseholdInvite(activeHouseholdId, email);
  return invite?.token ? `${window.location.origin}/login?invite=${invite.token}` : null;
}

export async function acceptInvite(token: string, session: Session): Promise<boolean> {
  const ok = await acceptHouseholdInvite(token, session);
  if (!ok) return false;
  await initCloudSync(session);
  return true;
}

function scheduleCloudSync() {
  if (!cloudSyncEnabled || !activeHouseholdId) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if (!activeHouseholdId) return;
    void saveHouseholdState(activeHouseholdId, state);
  }, 450);
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

  // Savings
  addSavings(e: Omit<SavingsAccount, "id">) {
    setState((s) => ({ ...s, savings: [...s.savings, { ...e, id: uid() }] }));
  },
  updateSavings(id: string, patch: Partial<SavingsAccount>) {
    setState((s) => ({
      ...s,
      savings: s.savings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  },
  removeSavings(id: string) {
    setState((s) => ({ ...s, savings: s.savings.filter((x) => x.id !== id) }));
  },

  updateGlobalSettings(patch: Partial<GlobalSettings>) {
    setState((s) => ({ ...s, globalSettings: { ...s.globalSettings, ...patch } }));
  },
  reset() {
    setState(() => DEFAULT_STATE);
  },
};
