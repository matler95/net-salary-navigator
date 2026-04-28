import type { Session } from "@supabase/supabase-js";
import type { AppState, Expense, Investment, Loan, Rental, Spouse } from "./store";
import { DEFAULT_SALARY_INPUTS } from "./salary";
import { getSupabase } from "./supabase";

export type HouseholdContext = {
  householdId: string;
  userId: string;
};

type HouseholdRow = { id: string };
type MembershipRow = { household_id: string; user_id: string; created_at?: string; role?: string };
type InviteRow = { id: string; household_id: string; email: string; token: string; expires_at?: string };
type InviteContext = {
  household_id: string;
  household_name: string;
  email: string;
  status: string;
  expires_at: string;
  is_valid: boolean;
};

let creatingHouseholdPromise: Promise<HouseholdContext | null> | null = null;

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

export async function loadHouseholdMembers(householdId: string): Promise<{ user_id: string; created_at: string; role: string }[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, created_at, role")
    .eq("household_id", householdId);

  if (error || !data) {
    console.error("Error loading household members:", error);
    return [];
  }

  return data as { user_id: string; created_at: string; role: string }[];
}

export async function loadHouseholdInvites(
  householdId: string,
  includeAll = false,
): Promise<{ id: string; email: string; expires_at: string; status: string }[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from("household_invites")
    .select("id, email, expires_at, status")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (!includeAll) {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error loading household invites:", error);
    return [];
  }

  return data as { id: string; email: string; expires_at: string; status: string }[];
}

export async function revokeHouseholdInvite(inviteId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc("revoke_invite", { invite_id: inviteId });
  if (error) {
    console.error("Error revoking invite:", error);
    return false;
  }
  return true;
}

export async function leaveHousehold(householdId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc("leave_household", {
    target_household_id: householdId,
  });
  if (error) {
    console.error("Error leaving household:", error);
    return false;
  }
  return true;
}

export async function transferOwnership(householdId: string, newOwnerId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc("transfer_ownership", {
    target_household_id: householdId,
    new_owner_id: newOwnerId,
  });
  if (error) {
    console.error("Error transferring ownership:", error);
    return false;
  }
  return true;
}

export async function removeHouseholdMember(householdId: string, userId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);
  if (error) {
    console.error("Error removing household member:", error);
    return false;
  }
  return true;
}

export async function ensureHouseholdForSession(
  session: Session,
  preferredHouseholdId?: string | null,
  householdName?: string | null,
): Promise<HouseholdContext | null> {
  const name = householdName?.trim() || "Moje gospodarstwo";
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

  if (creatingHouseholdPromise) {
    return creatingHouseholdPromise;
  }

  creatingHouseholdPromise = (async () => {
    const { data: householdId, error: householdError } = await supabase.rpc("create_household", {
      household_name: name,
    });

    if (!householdError && householdId) {
      return { householdId, userId };
    }

    console.error("Error creating household via RPC, trying fallback:", householdError);

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!existingMembershipError && existingMembership?.household_id) {
      return { householdId: existingMembership.household_id, userId };
    }

    const { data: created, error: insertHouseholdError } = (await supabase
      .from("households")
      .insert({ name })
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
      role: "owner",
    });

    if (insertMemberError && !String(insertMemberError.message ?? "").toLowerCase().includes("duplicate")) {
      console.error("Fallback membership creation failed:", insertMemberError);
      return null;
    }

    return { householdId: fallbackHouseholdId, userId };
  })();

  const result = await creatingHouseholdPromise;
  creatingHouseholdPromise = null;
  return result;
}

export async function updateUserMetadata(data: Record<string, unknown>): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.auth.updateUser({ data });
  if (error) {
    console.error("Error updating user metadata:", error);
    return false;
  }
  return true;
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

  const normalizedEmail = email.trim().toLowerCase();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existingInvite } = await supabase
    .from("household_invites")
    .select("id, household_id, email, token, status, expires_at")
    .eq("household_id", householdId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .single();

  if (existingInvite) {
    const { data, error } = await supabase
      .from("household_invites")
      .update({ token, expires_at: expiresAt })
      .eq("id", existingInvite.id)
      .select("id, household_id, email, token")
      .single();

    if (error || !data) {
      console.error("Error refreshing existing household invite:", error);
      return null;
    }
    return data as InviteRow;
  }

  const { data, error } = await supabase
    .from("household_invites")
    .insert({
      household_id: householdId,
      email: normalizedEmail,
      token,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id,household_id,email,token")
    .single();

  if (error || !data) {
    console.error("Error creating household invite:", error);
    return null;
  }
  return data as InviteRow;
}

export async function loadInviteContext(token: string): Promise<InviteContext | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;

  console.log("Loading invite context for token:", token);
  const { data, error } = await supabase.rpc("get_invite_context", {
    invite_token: token,
  });

  console.log("Invite context RPC result:", { data, error });
  if (error || !data) {
    console.error("Error loading invite context:", error);
    return null;
  }

  return data as InviteContext;
}

export async function acceptHouseholdInvite(token: string, session: Session): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;

  try {
    const { data: householdId, error } = await supabase.rpc("accept_invite", {
      invite_token: token,
    });
    if (error) {
      console.error("Error accepting invite via RPC:", error);
      return null;
    }
    return householdId as string | null;
  } catch (err) {
    console.error("Unexpected error accepting invite:", err);
    return null;
  }
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
    assigned_user_id: spouse.assignedUserId ?? null,
  };
}
function mapSpouseFromRow(row: unknown): Spouse {
  const r = asRecord(row);
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? "Małżonek"),
    inputs: { ...DEFAULT_SALARY_INPUTS, ...asRecord(r.inputs) },
    assignedUserId: r.assigned_user_id ? String(r.assigned_user_id) : undefined,
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
    tickerPriceAtAdd: x.tickerPriceAtAdd,
    tickerPriceDate: x.tickerPriceDate,
    value: x.value,
    monthlyContribution: x.monthlyContribution,
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
    tickerPriceAtAdd: Number(r.tickerPriceAtAdd ?? 0),
    tickerPriceDate: String(r.tickerPriceDate ?? ""),
    value: Number(r.value ?? 0),
    monthlyContribution: Number(r.monthlyContribution ?? 0),
  };
}
function mapLoanToRow(householdId: string, x: Loan) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    principal: x.principal,
    annualRatePct: x.annualRatePct,
    monthsRemaining: x.monthsRemaining,
    monthlyOverpayment: x.monthlyOverpayment,
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
    annualRatePct: Number(r.annualRatePct ?? 0),
    monthsRemaining: Number(r.monthsRemaining ?? 0),
    monthlyOverpayment: Number(r.monthlyOverpayment ?? 0),
    paymentDayOfMonth: r.paymentDayOfMonth ? Number(r.paymentDayOfMonth) : undefined,
    lastPaymentDate: r.lastPaymentDate ? String(r.lastPaymentDate) : undefined,
  };
}
function mapRentalToRow(householdId: string, x: Rental) {
  return {
    id: x.id,
    household_id: householdId,
    label: x.label,
    monthlyRent: x.monthlyRent,
    monthlyCosts: x.monthlyCosts,
    monthlyMortgage: x.monthlyMortgage,
    vacancyRatePct: x.vacancyRatePct,
    taxRatePct: x.taxRatePct,
    marketValue: x.marketValue,
  };
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
function mapSavingsToRow(householdId: string, account: AppState["savings"][number]) {
  return {
    id: account.id,
    household_id: householdId,
    bank: account.bank,
    type: account.type,
    balance: account.balance,
    ratePct: account.ratePct,
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
    ratePct: Number(r.ratePct ?? 0),
    lokataStartDate: r.lokataStartDate ? String(r.lokataStartDate) : undefined,
    lokataDurationMonths: r.lokataDurationMonths ? Number(r.lokataDurationMonths) : undefined,
    lokataCapitalization: r.lokataCapitalization ? String(r.lokataCapitalization) : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
