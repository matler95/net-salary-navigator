import type { Session } from "@supabase/supabase-js";
import type { AppState, Expense, Investment, Loan, Rental, Spouse } from "./store";
import { DEFAULT_SALARY_INPUTS } from "./salary";
import { getSupabase } from "./supabase";

export type HouseholdContext = {
  householdId: string;
  userId: string;
};

type HouseholdRow = { id: string };
type MembershipRow = { household_id: string; user_id: string; created_at?: string };
type InviteRow = { id: string; household_id: string; email: string; token: string };

export async function verifyHouseholdMembership(householdId: string, userId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return false;
  }
  return true;
}

export async function loadHouseholdMembers(householdId: string): Promise<{ user_id: string; created_at: string }[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, created_at")
    .eq("household_id", householdId);

  if (error || !data) {
    console.error("Error loading household members:", error);
    return [];
  }

  return data as { user_id: string; created_at: string }[];
}

export async function loadHouseholdInvites(householdId: string): Promise<{ email: string; expires_at: string }[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("household_invites")
    .select("email, expires_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error loading household invites:", error);
    return [];
  }

  return data as { email: string; expires_at: string }[];
}

export async function ensureHouseholdForSession(
  session: Session,
  preferredHouseholdId?: string | null,
): Promise<HouseholdContext | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const userId = session.user.id;

  const { data: memberships, error: membershipError } = (await supabase
    .from("household_members")
    .select("household_id,user_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })) as { data: MembershipRow[] | null; error: any };

  if (membershipError) {
    console.error("Error loading household membership:", membershipError);
  }

  const membershipsList = memberships ?? [];
  if (membershipsList.length > 0) {
    if (preferredHouseholdId) {
      const preferredMembership = membershipsList.find((m) => m.household_id === preferredHouseholdId);
      if (preferredMembership?.household_id) {
        return { householdId: preferredMembership.household_id, userId };
      }
    }
    return { householdId: membershipsList[0].household_id, userId };
  }

  const { data: householdId, error: householdError } = await supabase.rpc("create_household", {
    household_name: "Moje gospodarstwo",
  });
  
  if (!householdError && householdId) {
    return { householdId, userId };
  }

  console.error("Error creating household via RPC, trying fallback:", householdError);

  // Fallback for environments where RPC function was not created yet.
  const { data: created, error: insertHouseholdError } = (await supabase
    .from("households")
    .insert({ name: "Moje gospodarstwo" })
    .select("id")
    .single()) as { data: HouseholdRow | null; error: any };

  if (insertHouseholdError || !created?.id) {
    console.error("Fallback household creation failed:", insertHouseholdError);
    return null;
  }

  const fallbackHouseholdId = created.id;
  const { error: insertMemberError } = await supabase.from("household_members").insert({
    household_id: fallbackHouseholdId,
    user_id: userId,
  });

  if (insertMemberError && !String(insertMemberError.message ?? "").toLowerCase().includes("duplicate")) {
    console.error("Fallback membership creation failed:", insertMemberError);
    return null;
  }

  return { householdId: fallbackHouseholdId, userId };
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
      state.savings.map((x) => mapSavingsToRow(householdId, x)),
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
  if (error || !data) {
    console.error("Error creating household invite:", error);
    return null;
  }
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
  if (inviteError || !invite?.household_id) {
    console.error("Error loading invite by token:", inviteError);
    return false;
  }

  const inviteEmail = invite.email.trim().toLowerCase();
  const sessionEmail = (session.user.email ?? "").trim().toLowerCase();
  if (!sessionEmail || inviteEmail !== sessionEmail) {
    console.error("Invite email mismatch for current user.", { inviteEmail, sessionEmail });
    return false;
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: invite.household_id,
    user_id: session.user.id,
  });
  if (memberError && !memberError.message.toLowerCase().includes("duplicate")) {
    console.error("Error adding invited user to household:", memberError);
    return false;
  }

  const { error: deleteInviteError } = await supabase
    .from("household_invites")
    .delete()
    .eq("id", invite.id);
  if (deleteInviteError) {
    console.error("Error deleting accepted invite:", deleteInviteError);
  }
  return true;
}

async function replaceRows(table: string, householdId: string, rows: Record<string, unknown>[]) {
  const supabase = await getSupabase();
  if (!supabase) return;

  // Backup existing data first
  const { data: backupData, error: backupError } = await supabase
    .from(table)
    .select('*')
    .eq("household_id", householdId);

  if (backupError) {
    console.error(`Error backing up ${table}:`, backupError);
    throw backupError;
  }

  try {
    // Delete existing data
    const { error: deleteError } = await supabase.from(table).delete().eq("household_id", householdId);
    if (deleteError) {
      console.error(`Error deleting from ${table}:`, deleteError);
      throw deleteError;
    }

    if (rows.length === 0) return;

    // Insert new data
    const { error: insertError } = await supabase.from(table).insert(rows);
    if (insertError) {
      console.error(`Error inserting into ${table}:`, insertError);
      throw insertError;
    }
  } catch (error) {
    // Restore backup if operation failed
    if (backupData && backupData.length > 0) {
      console.log(`Restoring backup for ${table} due to error:`, error);
      const { error: restoreError } = await supabase.from(table).insert(backupData);
      if (restoreError) {
        console.error(`Critical: Failed to restore backup for ${table}:`, restoreError);
        // This is a critical failure - data might be lost
      }
    }
    throw error;
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
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    type: x.type,
    currency: x.currency,
    ticker: x.ticker,
    volume: x.volume,
    ticker_price_at_add: x.tickerPriceAtAdd,
    ticker_price_date: x.tickerPriceDate,
    value: x.value,
    monthly_contribution: x.monthlyContribution,
  };
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
    tickerPriceAtAdd: Number(r.ticker_price_at_add ?? 0),
    tickerPriceDate: String(r.ticker_price_date ?? ""),
    value: Number(r.value ?? 0),
    monthlyContribution: Number(r.monthly_contribution ?? 0),
  };
}
function mapLoanToRow(householdId: string, x: Loan) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    principal: x.principal,
    annual_rate_pct: x.annualRatePct,
    months_remaining: x.monthsRemaining,
    monthly_overpayment: x.monthlyOverpayment,
    payment_day_of_month: x.paymentDayOfMonth,
    last_payment_date: x.lastPaymentDate,
  };
}
function mapLoanFromRow(row: unknown): Loan {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    principal: Number(r.principal ?? 0),
    annualRatePct: Number(r.annual_rate_pct ?? 0),
    monthsRemaining: Number(r.months_remaining ?? 0),
    monthlyOverpayment: Number(r.monthly_overpayment ?? 0),
    paymentDayOfMonth: r.payment_day_of_month ? Number(r.payment_day_of_month) : undefined,
    lastPaymentDate: r.last_payment_date ? String(r.last_payment_date) : undefined,
  };
}
function mapRentalToRow(householdId: string, x: Rental) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    monthly_rent: x.monthlyRent,
    monthly_costs: x.monthlyCosts,
    monthly_mortgage: x.monthlyMortgage,
    vacancy_rate_pct: x.vacancyRatePct,
    tax_rate_pct: x.taxRatePct,
    market_value: x.marketValue,
  };
}
function mapRentalFromRow(row: unknown): Rental {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    monthlyRent: Number(r.monthly_rent ?? 0),
    monthlyCosts: Number(r.monthly_costs ?? 0),
    monthlyMortgage: Number(r.monthly_mortgage ?? 0),
    vacancyRatePct: Number(r.vacancy_rate_pct ?? 0),
    taxRatePct: Number(r.tax_rate_pct ?? 8.5),
    marketValue: Number(r.market_value ?? 0),
  };
}
function mapSavingsToRow(householdId: string, account: AppState["savings"][number]) {
  return {
    id: account.id,
    household_id: householdId,
    bank: account.bank,
    type: account.type,
    balance: account.balance,
    rate_pct: account.ratePct,
    lokata_start_date: account.lokataStartDate,
    lokata_duration_months: account.lokataDurationMonths,
    lokata_capitalization: account.lokataCapitalization,
  };
}

function mapSavingsFromRow(row: unknown): AppState["savings"][number] {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    bank: String(r.bank ?? ""),
    type: String(r.type ?? "zwykłe"),
    balance: Number(r.balance ?? 0),
    ratePct: Number(r.rate_pct ?? 0),
    lokataStartDate: r.lokata_start_date ? String(r.lokata_start_date) : undefined,
    lokataDurationMonths: r.lokata_duration_months ? Number(r.lokata_duration_months) : undefined,
    lokataCapitalization: r.lokata_capitalization ? String(r.lokata_capitalization) : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
