import type { Session } from "@supabase/supabase-js";
import type { AppState, Expense, Investment, Loan, Rental, Spouse } from "./store";
import { DEFAULT_SALARY_INPUTS } from "./salary";
import { supabase } from "./supabase";

export type HouseholdContext = {
  householdId: string;
  userId: string;
};

type HouseholdRow = { id: string };
type MembershipRow = { household_id: string; user_id: string };
type InviteRow = { id: string; household_id: string; email: string; token: string };

export async function ensureHouseholdForSession(
  session: Session,
): Promise<HouseholdContext | null> {
  if (!supabase) return null;
  const userId = session.user.id;
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id,user_id")
    .eq("user_id", userId)
    .maybeSingle<MembershipRow>();

  if (membership?.household_id) {
    return { householdId: membership.household_id, userId };
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ name: "Moje gospodarstwo" })
    .select("id")
    .single<HouseholdRow>();
  if (householdError || !household?.id) return null;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: userId,
  });
  if (memberError) return null;

  return { householdId: household.id, userId };
}

export async function loadHouseholdState(householdId: string): Promise<Partial<AppState>> {
  if (!supabase) return {};
  const [spouses, expenses, investments, loans, rentals] = await Promise.all([
    supabase.from("spouses").select("*").eq("household_id", householdId),
    supabase.from("expenses").select("*").eq("household_id", householdId),
    supabase.from("investments").select("*").eq("household_id", householdId),
    supabase.from("loans").select("*").eq("household_id", householdId),
    supabase.from("rentals").select("*").eq("household_id", householdId),
  ]);

  return {
    spouses: (spouses.data ?? []).map(mapSpouseFromRow),
    expenses: (expenses.data ?? []).map(mapExpenseFromRow),
    investments: (investments.data ?? []).map(mapInvestmentFromRow),
    loans: (loans.data ?? []).map(mapLoanFromRow),
    rentals: (rentals.data ?? []).map(mapRentalFromRow),
  };
}

export async function saveHouseholdState(householdId: string, state: AppState): Promise<void> {
  if (!supabase) return;
  await Promise.all([
    replaceRows(
      "spouses",
      householdId,
      state.spouses.map((x) => mapSpouseToRow(householdId, x)),
    ),
    replaceRows(
      "expenses",
      householdId,
      state.expenses.map((x) => mapExpenseToRow(householdId, x)),
    ),
    replaceRows(
      "investments",
      householdId,
      state.investments.map((x) => mapInvestmentToRow(householdId, x)),
    ),
    replaceRows(
      "loans",
      householdId,
      state.loans.map((x) => mapLoanToRow(householdId, x)),
    ),
    replaceRows(
      "rentals",
      householdId,
      state.rentals.map((x) => mapRentalToRow(householdId, x)),
    ),
  ]);
}

export async function createHouseholdInvite(householdId: string, email: string) {
  if (!supabase) return null;
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("household_invites")
    .insert({
      household_id: householdId,
      email: email.trim().toLowerCase(),
      token,
    })
    .select("id,household_id,email,token")
    .single<InviteRow>();
  if (error || !data) return null;
  return data;
}

export async function acceptHouseholdInvite(token: string, session: Session): Promise<boolean> {
  if (!supabase) return false;
  const { data: invite, error: inviteError } = await supabase
    .from("household_invites")
    .select("id,household_id,email,token")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<InviteRow>();
  if (inviteError || !invite?.household_id) return false;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: invite.household_id,
    user_id: session.user.id,
  });
  if (memberError && !memberError.message.toLowerCase().includes("duplicate")) return false;

  await supabase.from("household_invites").delete().eq("id", invite.id);
  return true;
}

async function replaceRows(table: string, householdId: string, rows: Record<string, unknown>[]) {
  if (!supabase) return;
  await supabase.from(table).delete().eq("household_id", householdId);
  if (rows.length === 0) return;
  await supabase.from(table).insert(rows);
}

function mapSpouseToRow(householdId: string, spouse: Spouse) {
  return {
    id: spouse.id,
    household_id: householdId,
    name: spouse.name,
    inputs: spouse.inputs,
  };
}
function mapSpouseFromRow(row: unknown): Spouse {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? "Małżonek"),
    inputs: { ...DEFAULT_SALARY_INPUTS, ...asRecord(r.inputs) },
  };
}
function mapExpenseToRow(householdId: string, x: Expense) {
  return { ...x, household_id: householdId };
}
function mapExpenseFromRow(row: unknown): Expense {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    category: String(r.category ?? "Inne"),
    label: String(r.label ?? ""),
    amount: Number(r.amount ?? 0),
    frequency: String(r.frequency ?? "monthly") as Expense["frequency"],
  };
}
function mapInvestmentToRow(householdId: string, x: Investment) {
  return { ...x, household_id: householdId };
}
function mapInvestmentFromRow(row: unknown): Investment {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    type: (r.type as Investment["type"]) ?? "ETF",
    currency: (r.currency as Investment["currency"]) ?? "PLN",
    ticker: String(r.ticker ?? ""),
    volume: Number(r.volume ?? 0),
    tickerPriceAtAdd: Number(r.tickerPriceAtAdd ?? 0),
    tickerPriceDate: String(r.tickerPriceDate ?? ""),
    value: Number(r.value ?? 0),
    monthlyContribution: Number(r.monthlyContribution ?? 0),
  };
}
function mapLoanToRow(householdId: string, x: Loan) {
  return { ...x, household_id: householdId };
}
function mapLoanFromRow(row: unknown): Loan {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    principal: Number(r.principal ?? 0),
    annualRatePct: Number(r.annualRatePct ?? 0),
    monthsRemaining: Number(r.monthsRemaining ?? 0),
    monthlyOverpayment: Number(r.monthlyOverpayment ?? 0),
  };
}
function mapRentalToRow(householdId: string, x: Rental) {
  return { ...x, household_id: householdId };
}
function mapRentalFromRow(row: unknown): Rental {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    monthlyRent: Number(r.monthlyRent ?? 0),
    monthlyCosts: Number(r.monthlyCosts ?? 0),
    monthlyMortgage: Number(r.monthlyMortgage ?? 0),
    vacancyRatePct: Number(r.vacancyRatePct ?? 0),
    taxRatePct: Number(r.taxRatePct ?? 8.5),
    marketValue: Number(r.marketValue ?? 0),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
