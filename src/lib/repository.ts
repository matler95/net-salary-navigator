import type { Session } from "@supabase/supabase-js";
import type { AppState, Expense, Investment, Loan, Rental, Spouse } from "./store";
import { DEFAULT_SALARY_INPUTS } from "./salary";
import { getSupabase } from "./supabase";

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
  const supabase = await getSupabase();
  if (!supabase) return null;
  const userId = session.user.id;
  const { data: membership } = (await supabase
    .from("household_members")
    .select("household_id,user_id")
    .eq("user_id", userId)
    .maybeSingle()) as { data: MembershipRow | null; error: any };

  if (membership?.household_id) {
    return { householdId: membership.household_id, userId };
  }

  const { data: household, error: householdError } = (await supabase
    .from("households")
    .insert({ name: "Moje gospodarstwo" })
    .select("id")
    .single()) as { data: HouseholdRow | null; error: any };
  if (householdError || !household?.id) return null;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: userId,
  });
  if (memberError) return null;

  return { householdId: household.id, userId };
}

export async function loadHouseholdState(householdId: string): Promise<Partial<AppState>> {
  console.log(`Loading household state for: ${householdId}`);
  const supabase = await getSupabase();
  if (!supabase) return {};

  const results = await Promise.all([
    supabase.from("spouses").select("*").eq("household_id", householdId),
    supabase.from("expenses").select("*").eq("household_id", householdId),
    supabase.from("investments").select("*").eq("household_id", householdId),
    supabase.from("loans").select("*").eq("household_id", householdId),
    supabase.from("rentals").select("*").eq("household_id", householdId),
    supabase.from("savings").select("*").eq("household_id", householdId),
    supabase.from("households").select("joint_filing, global_settings").eq("id", householdId).single(),
  ]);

  const [spouses, expenses, investments, loans, rentals, savings, household] = results;

  // Check for errors in any of the requests
  const errors = results.filter(r => r.error).map(r => r.error);
  if (errors.length > 0) {
    console.error("Errors loading household data:", errors);
    throw new Error(`Failed to load household data: ${errors[0]?.message}`);
  }

  return {
    spouses: (spouses.data ?? []).map(mapSpouseFromRow),
    expenses: (expenses.data ?? []).map(mapExpenseFromRow),
    investments: (investments.data ?? []).map(mapInvestmentFromRow),
    loans: (loans.data ?? []).map(mapLoanFromRow),
    rentals: (rentals.data ?? []).map(mapRentalFromRow),
    savings: (savings.data ?? []).map(mapSavingsFromRow),
    jointFiling: !!household.data?.joint_filing,
    globalSettings: household.data?.global_settings as any,
  };
}

export async function saveHouseholdState(householdId: string, state: AppState): Promise<void> {
  console.log(`Saving household state for: ${householdId}`);
  const supabase = await getSupabase();
  if (!supabase) {
    console.warn("Cannot save: Supabase client not available");
    return;
  }
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
    replaceRows(
      "savings",
      householdId,
      state.savings.map((x) => ({ ...x, household_id: householdId })),
    ),
    (async () => {
      const { error } = await supabase
        .from("households")
        .update({
          joint_filing: state.jointFiling,
          global_settings: state.globalSettings,
        })
        .eq("id", householdId);
      if (error) {
        console.error("Error updating household settings:", error);
        throw error;
      }
    })(),
  ]);
}

export async function createHouseholdInvite(householdId: string, email: string) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const token = crypto.randomUUID();
  const { data, error } = (await supabase
    .from("household_invites")
    .insert({
      household_id: householdId,
      email: email.trim().toLowerCase(),
      token,
    })
    .select("id,household_id,email,token")
    .single()) as { data: InviteRow | null; error: any };
  if (error || !data) return null;
  return data;
}

export async function acceptHouseholdInvite(token: string, session: Session): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data: invite, error: inviteError } = (await supabase
    .from("household_invites")
    .select("id,household_id,email,token")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()) as { data: InviteRow | null; error: any };
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
  const supabase = await getSupabase();
  if (!supabase) return;
  
  const { error: deleteError } = await supabase.from(table).delete().eq("household_id", householdId);
  if (deleteError) {
    console.error(`Error deleting from ${table}:`, deleteError);
    throw deleteError;
  }
  
  if (rows.length === 0) return;
  
  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) {
    console.error(`Error inserting into ${table}:`, insertError);
    throw insertError;
  }
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
    month: r.month ? Number(r.month) : undefined,
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
    paymentDayOfMonth: r.paymentDayOfMonth ? Number(r.paymentDayOfMonth) : undefined,
    lastPaymentDate: r.lastPaymentDate ? String(r.lastPaymentDate) : undefined,
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
function mapSavingsFromRow(row: unknown): any {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    bank: String(r.bank ?? ""),
    type: String(r.type ?? "zwykłe"),
    balance: Number(r.balance ?? 0),
    ratePct: Number(r.ratePct ?? 0),
    lokataStartDate: r.lokataStartDate ? String(r.lokataStartDate) : undefined,
    lokataDurationMonths: r.lokataDurationMonths ? Number(r.lokataDurationMonths) : undefined,
    lokataCapitalization: r.lokataCapitalization ? String(r.lokataCapitalization) : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
