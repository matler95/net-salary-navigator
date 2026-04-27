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
  verifyHouseholdMembership,
} from "./repository";
import { migrateLocalToCloudOnce } from "./migration";
import { getSupabase } from "./supabase";

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

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

export const STORAGE_KEY = "placa-netto-state-v1";
export const ACTIVE_HOUSEHOLD_KEY = "placa-netto-active-household-id";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

const DEFAULT_STATE: AppState = {
  spouses: [],
  jointFiling: false,
  expenses: [],
  investments: [],
  loans: [],
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
let cloudSyncInitialized = false;
let cloudRealtimeUnsubscribe: (() => void) | null = null;

// Debounced version of syncFromCloud to prevent rapid calls from realtime subscriptions
const debouncedSyncFromCloud = debounce(syncFromCloud, 500);

function mergeGlobalSettings(next?: Partial<GlobalSettings>): GlobalSettings {
  if (!next) return state.globalSettings;
  return {
    ...DEFAULT_STATE.globalSettings,
    ...state.globalSettings,
    ...next,
  };
}

function loadInitial(): AppState {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

export function clearAppState(): void {
  state = DEFAULT_STATE;
  cloudSyncEnabled = false;
  cloudSyncInitialized = false;
  activeHouseholdId = null;
  syncInProgress = false;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (cloudRealtimeUnsubscribe) {
    cloudRealtimeUnsubscribe();
    cloudRealtimeUnsubscribe = null;
  }
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore localStorage write errors
  }
  listeners.forEach((l) => l());
}

export function getActiveHouseholdId(): string | null {
  return activeHouseholdId;
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
    cloudSyncInitialized = false;
    if (cloudRealtimeUnsubscribe) {
      cloudRealtimeUnsubscribe();
      cloudRealtimeUnsubscribe = null;
    }
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    return;
  }
  // Prevent concurrent initialisations from racing
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    const preferredHouseholdId =
      typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_HOUSEHOLD_KEY) : null;
    const household = await ensureHouseholdForSession(session, preferredHouseholdId);
    // `return` inside try still triggers finally, so syncInProgress resets correctly
    if (!household?.householdId) return;
    activeHouseholdId = household.householdId;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, household.householdId);
    }
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
      globalSettings: mergeGlobalSettings(cloudState.globalSettings),
    };
    persist();
    cloudSyncInitialized = true;
    if (cloudRealtimeUnsubscribe) {
      cloudRealtimeUnsubscribe();
      cloudRealtimeUnsubscribe = null;
    }
    try {
      cloudRealtimeUnsubscribe = await subscribeToCloudChanges(household.householdId);
      if (!cloudRealtimeUnsubscribe) {
        console.error("Failed to establish realtime subscription, sync may be delayed");
      }
    } catch (error) {
      console.error("Error subscribing to cloud changes:", error);
      // Realtime is optional - regular scheduled sync will still work
    }
    listeners.forEach((l) => l());
  } finally {
    syncInProgress = false;
  }
}

// Re-verify household membership periodically and on sync
async function verifyAndRestoreHouseholdAccess(): Promise<boolean> {
  if (!activeHouseholdId) return false;

  const supabase = await getSupabase();
  if (!supabase) return false;

  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session?.user.id) return false;

  const isMember = await verifyHouseholdMembership(activeHouseholdId, session.session.user.id);
  if (!isMember) {
    console.warn(`User no longer member of household ${activeHouseholdId}, clearing sync`);
    cloudSyncEnabled = false;
    activeHouseholdId = null;
    cloudSyncInitialized = false;
    if (cloudRealtimeUnsubscribe) {
      cloudRealtimeUnsubscribe();
      cloudRealtimeUnsubscribe = null;
    }
    return false;
  }

  return true;
}

export async function createInvite(email: string): Promise<string | null> {
  let householdId = activeHouseholdId;

  if (!householdId) {
    const supabase = await getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const preferredHouseholdId =
          typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_HOUSEHOLD_KEY) : null;
        const household = await ensureHouseholdForSession(data.session, preferredHouseholdId);
        householdId = household?.householdId ?? null;
        if (householdId) {
          activeHouseholdId = householdId;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, householdId);
          }
          cloudSyncEnabled = true;
        }
      }
    }
  }

  if (!householdId) {
    throw new Error("Brak aktywnego gospodarstwa domowego dla zalogowanego użytkownika.");
  }
  const invite = await createHouseholdInvite(householdId, email);
  if (!invite?.token) {
    throw new Error(
      "Nie udało się zapisać zaproszenia w bazie. Sprawdź konfigurację polityk RLS tabeli household_invites.",
    );
  }
  return `${window.location.origin}/login?invite=${invite.token}`;
}

export async function acceptInvite(token: string, session: Session): Promise<boolean> {
  const ok = await acceptHouseholdInvite(token, session);
  if (!ok) return false;
  await initCloudSync(session);
  return true;
}

let lastCloudSyncTime = 0;
export async function syncFromCloud() {
  if (!activeHouseholdId || syncInProgress) return;
  
  // Verify membership before syncing
  const membershipOk = await verifyAndRestoreHouseholdAccess();
  if (!membershipOk) return;

  // Debounce cloud fetches to once every 2 seconds
  const now = Date.now();
  if (now - lastCloudSyncTime < 2000) return;
  lastCloudSyncTime = now;

  syncInProgress = true;
  console.log("Syncing from cloud due to external change...");
  try {
    const cloudState = await loadHouseholdState(activeHouseholdId);
    state = {
      ...state,
      spouses: cloudState.spouses?.length ? cloudState.spouses : state.spouses,
      expenses: cloudState.expenses ?? state.expenses,
      investments: cloudState.investments ?? state.investments,
      loans: cloudState.loans ?? state.loans,
      rentals: cloudState.rentals ?? state.rentals,
      savings: cloudState.savings ?? state.savings,
      jointFiling: cloudState.jointFiling ?? state.jointFiling,
      globalSettings: mergeGlobalSettings(cloudState.globalSettings),
    };
    persist();
    listeners.forEach((l) => l());
  } catch (error) {
    console.error("Failed to sync from cloud:", error);
  } finally {
    // Add a small delay to prevent immediate re-triggering if local state updates take time
    setTimeout(() => {
      syncInProgress = false;
    }, 100);
  }
}

async function subscribeToCloudChanges(householdId: string) {
  const supabase = await getSupabase();
  if (!supabase) return null;

  try {
    // Subscribe to all relevant tables for this household
    const channel = supabase.channel(`household:${householdId}`);
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spouses', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings', filter: `household_id=eq.${householdId}` }, debouncedSyncFromCloud)
      .subscribe((status, err) => {
        console.log(`Supabase Realtime status for household ${householdId}:`, status);
        if (err) {
          console.error(`Realtime subscription error for household ${householdId}:`, err);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime channel failed for household ${householdId}, status: ${status}`);
          // Could implement retry logic here
        }
      });
      
    return () => {
      void supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error(`Failed to subscribe to cloud changes for household ${householdId}:`, error);
    return null;
  }
}

async function ensureCloudSyncContext(): Promise<boolean> {
  if (cloudSyncEnabled && activeHouseholdId && cloudSyncInitialized) return true;
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  await initCloudSync(data.session);
  return !!(cloudSyncEnabled && activeHouseholdId && cloudSyncInitialized);
}

function scheduleCloudSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const ready = await ensureCloudSyncContext();
    if (!ready || !activeHouseholdId) return;
    try {
      console.log("Starting cloud sync...");
      await saveHouseholdState(activeHouseholdId, state);
      console.log("Cloud sync completed successfully");
    } catch (error) {
      console.error("Cloud sync failed:", error);
    }
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
