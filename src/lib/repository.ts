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

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
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
    tickerpriceatadd: x.tickerPriceAtAdd,
    tickerpricedate: x.tickerPriceDate,
    value: x.value,
    monthlycontribution: x.monthlyContribution,
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
    tickerPriceAtAdd: Number(getField(r, "tickerPriceAtAdd", "tickerpriceatadd") ?? 0),
    tickerPriceDate: String(getField(r, "tickerPriceDate", "tickerpricedate") ?? ""),
    value: Number(r.value ?? 0),
    monthlyContribution: Number(getField(r, "monthlyContribution", "monthlycontribution") ?? 0),
  };
}
function mapLoanToRow(householdId: string, x: Loan) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    principal: x.principal,
    annualratepct: x.annualRatePct,
    monthsremaining: x.monthsRemaining,
    monthlyoverpayment: x.monthlyOverpayment,
    paymentDayOfMonth: x.paymentDayOfMonth,
    lastPaymentDate: x.lastPaymentDate,
  };
}
function mapLoanFromRow(row: unknown): Loan {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    principal: Number(r.principal ?? 0),
    annualRatePct: Number(getField(r, "annualRatePct", "annualratepct") ?? 0),
    monthsRemaining: Number(getField(r, "monthsRemaining", "monthsremaining") ?? 0),
    monthlyOverpayment: Number(getField(r, "monthlyOverpayment", "monthlyoverpayment") ?? 0),
    paymentDayOfMonth: getField(r, "paymentDayOfMonth", "paymentdayofmonth")
      ? Number(getField(r, "paymentDayOfMonth", "paymentdayofmonth"))
      : undefined,
    lastPaymentDate: getField(r, "lastPaymentDate", "lastpaymentdate")
      ? String(getField(r, "lastPaymentDate", "lastpaymentdate"))
      : undefined,
  };
}
function mapRentalToRow(householdId: string, x: Rental) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    monthlyrent: x.monthlyRent,
    monthlycosts: x.monthlyCosts,
    monthlymortgage: x.monthlyMortgage,
    vacancyratepct: x.vacancyRatePct,
    taxratepct: x.taxRatePct,
    marketvalue: x.marketValue,
  };
}
function mapRentalFromRow(row: unknown): Rental {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    label: String(r.label ?? ""),
    monthlyRent: Number(getField(r, "monthlyRent", "monthlyrent") ?? 0),
    monthlyCosts: Number(getField(r, "monthlyCosts", "monthlycosts") ?? 0),
    monthlyMortgage: Number(getField(r, "monthlyMortgage", "monthlymortgage") ?? 0),
    vacancyRatePct: Number(getField(r, "vacancyRatePct", "vacancyratepct") ?? 0),
    taxRatePct: Number(getField(r, "taxRatePct", "taxratepct") ?? 8.5),
    marketValue: Number(getField(r, "marketValue", "marketvalue") ?? 0),
  };
}
function mapSavingsToRow(householdId: string, account: AppState["savings"][number]) {
  return {
    id: account.id,
    household_id: householdId,
    bank: account.bank,
    type: account.type,
    balance: account.balance,
    ratepct: account.ratePct,
    lokataStartDate: account.lokataStartDate,
    lokataDurationMonths: account.lokataDurationMonths,
    lokataCapitalization: account.lokataCapitalization,
  };
}

function mapSavingsFromRow(row: unknown): AppState["savings"][number] {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    bank: String(r.bank ?? ""),
    type: String(r.type ?? "zwykłe"),
    balance: Number(r.balance ?? 0),
    ratePct: Number(getField(r, "ratePct", "ratepct") ?? 0),
    lokataStartDate: getField(r, "lokataStartDate", "lokatastartdate")
      ? String(getField(r, "lokataStartDate", "lokatastartdate"))
      : undefined,
    lokataDurationMonths: getField(r, "lokataDurationMonths", "lokatadurationmonths")
      ? Number(getField(r, "lokataDurationMonths", "lokatadurationmonths"))
      : undefined,
    lokataCapitalization: getField(r, "lokataCapitalization", "lokatacapitalization")
      ? String(getField(r, "lokataCapitalization", "lokatacapitalization"))
      : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
