/**
 * Obligacje Skarbu Państwa (Polish Government Bonds) - comparison module
 *
 * Data sourced from: https://www.obligacjeskarbowe.pl/
 * Interest rates updated periodically. For indexed bonds we use current base rates.
 *
 * Bond types (2025):
 * - OTS: 3-month savings bonds (fixed)
 * - ROR: 1-year savings bonds (NBP reference rate-indexed, monthly)
 * - DOR: 2-year savings bonds (NBP reference rate-indexed, monthly)
 * - TOS: 3-year savings bonds (fixed)
 * - COI: 4-year savings bonds (CPI-indexed)
 * - EDO: 10-year savings bonds (CPI-indexed)
 * - ROS: 6-year savings bonds (CPI-indexed, family bonds)
 * - ROD: 12-year savings bonds (CPI-indexed, family bonds)
 *
 * Early redemption: Most bonds can be redeemed early with a penalty (utrata odsetek).
 */

export type BondCategory = "fixed" | "nbp_indexed" | "cpi_indexed";

export interface ObligacjaBond {
  symbol: string;
  name: string;
  tenorMonths: number; // total duration in months
  category: BondCategory;

  // Fixed bonds
  annualRatePct?: number;

  // NBP-indexed bonds (rate = NBP ref rate + margin)
  nbpMonth1Pct?: number; // Month 1 fixed rate
  nbpMarginPct?: number; // added on top of NBP reference rate

  // CPI-indexed bonds
  // Year 1 is fixed, subsequent years = CPI + margin
  cpiYear1Pct?: number;
  cpiMarginPct?: number;

  // Early redemption penalty (in PLN per 100 PLN face value, or %)
  earlyRedemptionPenaltyPct?: number; // % of interest earned (0 = all interest lost)
  earlyRedemptionFixedFee?: number; // fixed PLN fee per 100 PLN nominal (e.g. 0.70 zł)
  minHoldMonths?: number; // minimum hold period before early exit allowed

  description: string;
  notes?: string;
  compounding?: boolean; // whether interest is added to principal each year
}

// Current NBP reference rate (NBP stopa referencyjna)
// As of May 2026
export const NBP_REFERENCE_RATE_PCT = 4.0;

// Current estimated CPI for Poland
// National Bank of Poland projection for 2026: ~4.5%
export const CURRENT_CPI_ESTIMATE_PCT = 4.5;
// ISO date string — must be parseable by new Date()
export const OBLIGACJE_LAST_UPDATED = "2026-05-01T00:00:00.000Z";

// Belka tax rate on interest income
export const BELKA_TAX_PCT = 19;

export const OBLIGACJE_CATALOG: ObligacjaBond[] = [
  {
    symbol: "OTS",
    name: "3-miesięczne oszczędnościowe",
    tenorMonths: 3,
    category: "fixed",
    annualRatePct: 2.00,
    earlyRedemptionPenaltyPct: 100, // all interest lost
    minHoldMonths: 1,
    description: "Stałe oprocentowanie przez cały okres.",
    notes: "Najkrótszy dostępny instrument. Idealne dla płynności.",
    compounding: false,
  },
  {
    // Emisja ROR0527: Miesiąc 1 = 4,00% stałe. Miesiące 2-12 = stopa NBP (marża 0%)
    symbol: "ROR",
    name: "12-miesięczne (stopa NBP)",
    tenorMonths: 12,
    category: "nbp_indexed",
    nbpMonth1Pct: 4.00,  // M1 fixed rate from emission letter
    nbpMarginPct: 0.00,  // subsequent months = NBP + 0%
    earlyRedemptionFixedFee: 0.50,
    minHoldMonths: 1,
    description: "Miesiąc 1: stałe 4,00%. Miesiące 2-12: stopa referencyjna NBP.",
    notes: "Odsetki wypłacane co miesiąc. Zmiana NBP wpływa od miesiąca 2.",
    compounding: false,
  },
  {
    // Emisja DOR0528: Miesiąc 1 = 4,15% stałe. Miesiące 2-24 = NBP + 0,15%
    symbol: "DOR",
    name: "2-letnie (stopa NBP)",
    tenorMonths: 24,
    category: "nbp_indexed",
    nbpMonth1Pct: 4.15,  // M1 fixed rate from emission letter
    nbpMarginPct: 0.15,  // subsequent months = NBP + 0.15%
    earlyRedemptionFixedFee: 0.70,
    minHoldMonths: 1,
    description: "Miesiąc 1: stałe 4,15%. Miesiące 2-24: stopa NBP + 0,15 p.p.",
    notes: "Odsetki wypłacane co miesiąc. Lepsza marża niż ROR.",
    compounding: false,
  },
  {
    // Emisja TOS0529: stałe 4,40% przez cały okres
    symbol: "TOS",
    name: "3-letnie stałoprocentowe",
    tenorMonths: 36,
    category: "fixed",
    annualRatePct: 4.40,
    earlyRedemptionFixedFee: 1.00,
    minHoldMonths: 1,
    description: "Stałe 4,40% przez 3 lata. Odsetki kapitalizowane rocznie, wypłacane w dniu wykupu.",
    notes: "Zysk znany z góry. Chroni przed obniżkami stóp NBP.",
    compounding: true,
  },
  {
    // Emisja COI0530: Rok 1 = 4,75% stałe. Lata 2-4 = inflacja CPI + 1,50%
    symbol: "COI",
    name: "4-letnie (inflacja CPI)",
    tenorMonths: 48,
    category: "cpi_indexed",
    cpiYear1Pct: 4.75,   // Year 1 fixed rate from emission letter
    cpiMarginPct: 1.50,  // subsequent years = CPI + 1.50%
    earlyRedemptionFixedFee: 2.00, // new rate since Sep 2024 emissions
    minHoldMonths: 1,
    description: "Rok 1: stałe 4,75%. Lata 2-4: inflacja CPI + 1,50 p.p. Odsetki wypłacane co roku.",
    notes: "Ochrona przed inflacją od roku 2. Brak kapitalizacji odsetek.",
    compounding: false,
  },
  {
    // Emisja EDO0536: Rok 1 = 5,35% stałe. Lata 2-10 = inflacja CPI + 2,00% (kapitalizacja)
    symbol: "EDO",
    name: "10-letnie (inflacja CPI)",
    tenorMonths: 120,
    category: "cpi_indexed",
    cpiYear1Pct: 5.35,   // Year 1 fixed rate from emission letter
    cpiMarginPct: 2.00,  // subsequent years = CPI + 2.00%
    earlyRedemptionFixedFee: 3.00,
    minHoldMonths: 1,
    description: "Rok 1: stałe 5,35%. Lata 2-10: inflacja CPI + 2,00 p.p. Odsetki kapitalizowane.",
    notes: "Najlepsza ochrona przed inflacją + procent składany.",
    compounding: true,
  },
];

export interface BondYearlyPoint {
  year: number;
  nominalValue: number;
  nominalValueNet: number; // after Belka tax
  annualRatePct: number; // effective rate used this year
  annualInterest: number;
  cumulativeInterestGross: number;
  cumulativeInterestNet: number;
  isEarlyRedemption: boolean;
  isMaturity?: boolean;
  penaltyApplied: number;
}

export interface BondProjection {
  bond: ObligacjaBond;
  holdingYears: number;
  initialInvestment: number;
  totalGrossInterest: number;
  totalNetInterest: number; // after Belka
  finalValueNet: number;
  totalReturnPct: number;
  totalReturnNetPct: number;
  irrAnnualPct: number;
  irrAnnualNetPct: number;
  isEarlyRedemption: boolean; // true if holdingYears < tenor/12
  yearsRemaining: number; // if early redemption: years left on bond
  penaltyTotal: number;
  yearly: BondYearlyPoint[];
  assumedCpiPct: number;
  assumedNbpPct: number;
  warningMessage?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Get the effective annual interest rate for a given year on a bond.
 * Year is 1-indexed.
 */
export function getBondAnnualRate(
  bond: ObligacjaBond,
  year: number,
  assumedCpiPct: number,
  assumedNbpPct: number,
): number {
  switch (bond.category) {
    case "fixed":
      return bond.annualRatePct ?? 0;
    case "nbp_indexed": {
      const nominalRateBase = assumedNbpPct + (bond.nbpMarginPct ?? 0);
      
      if (year === 1 && bond.nbpMonth1Pct !== undefined) {
        // Month 1 is fixed, months 2-12 are NBP + margin
        // Since interest is paid out monthly (no compounding), we use simple sum
        const m1 = bond.nbpMonth1Pct / 12;
        const mBase = nominalRateBase / 12;
        return round2(m1 + 11 * mBase);
      }
      
      return round2(nominalRateBase);
    }
    case "cpi_indexed":
      if (year === 1) return bond.cpiYear1Pct ?? 0;
      return Math.max(0, assumedCpiPct + (bond.cpiMarginPct ?? 0));
    default:
      return 0;
  }
}

/**
 * Calculate the Belka tax on gross interest income.
 */
export function calcBelkaTax(grossInterest: number): number {
  return round2(grossInterest * (BELKA_TAX_PCT / 100));
}

/**
 * Project bond returns for a given holding period.
 *
 * If holdingYears > tenorMonths/12, the bond matures before the analysis ends and
 * the final amount is held constant afterward (no rollover assumption).
 * If holdingYears < tenorMonths/12, we apply early redemption penalty.
 */
export function projectBond(
  bond: ObligacjaBond,
  initialInvestment: number,
  holdingYears: number,
  assumedCpiPct: number = CURRENT_CPI_ESTIMATE_PCT,
  assumedNbpPct: number = NBP_REFERENCE_RATE_PCT,
): BondProjection {
  const tenorYears = bond.tenorMonths / 12;
  const maturityYear = Math.max(1, Math.round(tenorYears));
  const isEarlyRedemption = holdingYears < tenorYears;
  const yearsRemaining = isEarlyRedemption ? tenorYears - holdingYears : 0;
  const isMaturingBeforeAnalysis = holdingYears > tenorYears;
  const projectedYears = Math.min(holdingYears, maturityYear);

  const yearly: BondYearlyPoint[] = [];
  let currentValue = initialInvestment;
  const faceValue = initialInvestment;
  let cumulativeGross = 0;

  // For bonds with annual compounding (e.g. TOS, EDO)
  // Interest is earned on the GROWING balance, not just the original face value
  const isCompounding = !!bond.compounding;

  for (let y = 1; y <= projectedYears; y++) {
    const annualRate = getBondAnnualRate(bond, y, assumedCpiPct, assumedNbpPct);
    // For compounding bonds, interest accrues on current (growing) value
    const baseForInterest = isCompounding ? currentValue : faceValue;
    const annualInterestGross = round2(baseForInterest * (annualRate / 100));
    cumulativeGross += annualInterestGross;

    if (isCompounding) {
      currentValue = round2(currentValue + annualInterestGross);
    }

    yearly.push({
      year: y,
      nominalValue: round2(isCompounding ? currentValue : initialInvestment + cumulativeGross),
      nominalValueNet: 0, // filled below
      annualRatePct: annualRate,
      annualInterest: annualInterestGross,
      cumulativeInterestGross: round2(cumulativeGross),
      cumulativeInterestNet: 0,
      isEarlyRedemption: false,
      isMaturity: y === maturityYear && isMaturingBeforeAnalysis,
      penaltyApplied: 0,
    });
  }

  // Apply early redemption penalty if applicable
  let penaltyTotal = 0;
  if (isEarlyRedemption && cumulativeGross > 0) {
    if (bond.earlyRedemptionFixedFee !== undefined) {
      // Fixed fee per 100 PLN face value (single early redemption event)
      penaltyTotal = round2((initialInvestment / 100) * bond.earlyRedemptionFixedFee);
      // Penalty cannot exceed gross interest
      penaltyTotal = Math.min(penaltyTotal, cumulativeGross);
    } else if (bond.earlyRedemptionPenaltyPct !== undefined) {
      penaltyTotal = round2(cumulativeGross * (bond.earlyRedemptionPenaltyPct / 100));
    }
  }

  const totalGrossInterest = round2(Math.max(0, cumulativeGross - penaltyTotal));
  const belkaTax = calcBelkaTax(totalGrossInterest);
  const totalNetInterest = round2(totalGrossInterest - belkaTax);
  const finalValueNet = round2(initialInvestment + totalNetInterest);
  const totalReturnPct = round2((cumulativeGross / initialInvestment) * 100);
  const totalReturnNetPct = round2((totalNetInterest / initialInvestment) * 100);

  // Annualized net return (CAGR)
  const irrAnnualNetPct =
    holdingYears > 0 && totalNetInterest >= 0
      ? round2((Math.pow(finalValueNet / initialInvestment, 1 / holdingYears) - 1) * 100)
      : 0;

  const irrAnnualPct =
    holdingYears > 0 && cumulativeGross > 0
      ? round2(
          (Math.pow((initialInvestment + cumulativeGross) / initialInvestment, 1 / holdingYears) -
            1) *
            100,
        )
      : 0;

  // Fill in net values on yearly points
  yearly.forEach((pt, idx) => {
    const grossUpToHere = pt.cumulativeInterestGross;
    let netInterestHere = grossUpToHere;
    // Apply penalty only in final year for display
    if (isEarlyRedemption && idx === yearly.length - 1) {
      pt.isEarlyRedemption = true;
      pt.penaltyApplied = penaltyTotal;
      netInterestHere = Math.max(0, grossUpToHere - penaltyTotal);
    }
    const belka = calcBelkaTax(netInterestHere);
    pt.cumulativeInterestNet = round2(netInterestHere - belka);
    pt.nominalValueNet = round2(initialInvestment + pt.cumulativeInterestNet);
  });

  if (isMaturingBeforeAnalysis) {
    const maturityPoint = yearly[yearly.length - 1];
    for (let y = maturityYear + 1; y <= holdingYears; y++) {
      yearly.push({
        year: y,
        nominalValue: maturityPoint.nominalValue,
        nominalValueNet: maturityPoint.nominalValueNet,
        annualRatePct: 0,
        annualInterest: 0,
        cumulativeInterestGross: maturityPoint.cumulativeInterestGross,
        cumulativeInterestNet: maturityPoint.cumulativeInterestNet,
        isEarlyRedemption: false,
        isMaturity: false,
        penaltyApplied: 0,
      });
    }
  }

  let warningMessage: string | undefined;
  if (isEarlyRedemption) {
    warningMessage = `Okres analizy (${holdingYears} lat) jest krótszy niż czas trwania obligacji (${tenorYears} lat). Zakładamy wykup po okresie analizy i naliczenie kary za wcześniejszy wykup.`;
  } else if (holdingYears > tenorYears) {
    warningMessage = `Obligacja kończy się po ${tenorYears} latach. W dalszych latach do ${holdingYears} lat zakładamy zatrzymanie środków w gotówce (bez rolowania).`;
  }

  return {
    bond,
    holdingYears,
    initialInvestment,
    totalGrossInterest: cumulativeGross,
    totalNetInterest,
    finalValueNet,
    totalReturnPct,
    totalReturnNetPct,
    irrAnnualPct,
    irrAnnualNetPct,
    isEarlyRedemption,
    yearsRemaining,
    penaltyTotal,
    yearly,
    assumedCpiPct,
    assumedNbpPct,
    warningMessage,
  };
}

/**
 * Get scenario label for what assumptions are built in.
 */
export function getBondAssumptionLabel(bond: ObligacjaBond): string {
  switch (bond.category) {
    case "fixed":
      return `Stałe ${bond.annualRatePct}%`;
    case "nbp_indexed":
      return `Stopa NBP${bond.nbpMarginPct ? ` + ${bond.nbpMarginPct}%` : ""}`;
    case "cpi_indexed":
      return `Rok 1: ${bond.cpiYear1Pct}%, potem CPI + ${bond.cpiMarginPct}%`;
    default:
      return "";
  }
}

// Data fetching and override functionality

export interface BondDataOverride extends Partial<ObligacjaBond> {
  symbol: string;
}

export interface BondDataOverrides {
  lastUpdated: string;
  nbpReferenceRate?: number;
  cpiEstimate?: number;
  bonds: BondDataOverride[];
  source: string;
  isUserOverride: boolean;
}

/**
 * Fetch latest bond data from the API
 */
export async function fetchLatestBondData(): Promise<BondDataOverrides | null> {
  try {
    const response = await fetch('/api/obligacje/latest');
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json();

    return {
      lastUpdated: data.lastUpdated,
      nbpReferenceRate: data.nbpReferenceRate,
      cpiEstimate: data.cpiEstimate,
      bonds: data.bonds,
      source: data.source,
      isUserOverride: false
    };
  } catch (error) {
    console.error('Failed to fetch bond data:', error);
    return null;
  }
}

/**
 * Apply overrides to the bond catalog
 */
export function applyBondOverrides(
  baseCatalog: ObligacjaBond[],
  overrides: BondDataOverrides
): ObligacjaBond[] {
  const updatedCatalog = baseCatalog.map(bond => ({ ...bond }));

  overrides.bonds.forEach(override => {
    const bondIndex = updatedCatalog.findIndex(b => b.symbol === override.symbol);
    if (bondIndex >= 0) {
      const bond = updatedCatalog[bondIndex];
      Object.entries(override).forEach(([key, value]) => {
        if (key === 'symbol' || value === undefined || value === null) return;
        (bond as any)[key] = value;
      });
    }
  });

  return updatedCatalog;
}

/**
 * Get current bond catalog with any active overrides applied
 */
export function getCurrentBondCatalog(overrides?: BondDataOverrides): ObligacjaBond[] {
  const catalog = OBLIGACJE_CATALOG.map(bond => ({ ...bond }));
  if (!overrides) {
    return catalog;
  }

  const merged = applyBondOverrides(catalog, overrides);

  overrides.bonds.forEach(override => {
    const exists = merged.some(bond => bond.symbol === override.symbol);
    if (!exists) {
      merged.push({
        symbol: override.symbol,
        name: override.name ?? override.symbol,
        category: override.category ?? 'fixed',
        tenorMonths: override.tenorMonths ?? 12,
        annualRatePct: override.annualRatePct,
        nbpMarginPct: override.nbpMarginPct,
        cpiYear1Pct: override.cpiYear1Pct,
        cpiMarginPct: override.cpiMarginPct,
        earlyRedemptionPenaltyPct: override.earlyRedemptionPenaltyPct,
        earlyRedemptionFixedFee: override.earlyRedemptionFixedFee,
        minHoldMonths: override.minHoldMonths,
        description: override.description ?? '',
        notes: override.notes,
      });
    }
  });

  return merged;
}

/**
 * Check if bond data is outdated (more than 30 days old).
 * Handles unparseable date strings gracefully.
 */
export function isBondDataOutdated(lastUpdated: string): boolean {
  const updateDate = new Date(lastUpdated);
  if (isNaN(updateDate.getTime())) return true; // treat invalid date as outdated
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return updateDate < thirtyDaysAgo;
}

/**
 * Get display text for last updated date
 */
export function getLastUpdatedText(lastUpdated: string, isUserOverride: boolean = false): string {
  const date = new Date(lastUpdated);
  const formatted = isNaN(date.getTime())
    ? lastUpdated
    : date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });

  if (isUserOverride) {
    return `Dane nadpisane przez użytkownika (${formatted})`;
  }

  return `Dane aktualne na: ${formatted}`;
}

/**
 * Load latest bond data directly from Supabase (client-side).
 * Used for auto-loading on mount — bypasses the server scraper route.
 * Returns null if Supabase is unavailable or query fails.
 */
export async function loadBondDataFromSupabase(): Promise<BondDataOverrides | null> {
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = await getSupabase();
    if (!supabase) return null;

    const [{ data: bonds, error: bondsError }, { data: indicators, error: indicatorsError }] =
      await Promise.all([
        supabase.from('bond_data').select('*').eq('is_active', true).order('symbol'),
        supabase.from('economic_indicators').select('*').eq('is_active', true),
      ]);

    if (bondsError || indicatorsError || !bonds || bonds.length === 0) return null;

    const nbp = indicators?.find((i: any) => i.indicator_type === 'nbp_reference_rate')?.value;
    const cpi = indicators?.find((i: any) => i.indicator_type === 'cpi_estimate')?.value;
    // Use the most recent fetched_at across all bonds
    const latestFetchedAt = bonds.reduce((latest: string, b: any) => {
      return !latest || b.fetched_at > latest ? b.fetched_at : latest;
    }, '');

    return {
      lastUpdated: latestFetchedAt || new Date().toISOString(),
      nbpReferenceRate: nbp !== undefined ? Number(nbp) : NBP_REFERENCE_RATE_PCT,
      cpiEstimate: cpi !== undefined ? Number(cpi) : CURRENT_CPI_ESTIMATE_PCT,
      bonds: bonds.map((b: any) => ({
        symbol: b.symbol,
        name: b.name,
        category: b.category as BondCategory,
        tenorMonths: b.tenor_months,
        annualRatePct: b.annual_rate_pct !== null ? Number(b.annual_rate_pct) : undefined,
        nbpMonth1Pct: b.nbp_month1_pct !== null && b.nbp_month1_pct !== undefined ? Number(b.nbp_month1_pct) : undefined,
        nbpMarginPct: b.nbp_margin_pct !== null ? Number(b.nbp_margin_pct) : undefined,
        cpiYear1Pct: b.cpi_year1_pct !== null ? Number(b.cpi_year1_pct) : undefined,
        cpiMarginPct: b.cpi_margin_pct !== null ? Number(b.cpi_margin_pct) : undefined,
        earlyRedemptionPenaltyPct: b.early_redeem_penalty_pct !== null ? Number(b.early_redeem_penalty_pct) : undefined,
        earlyRedemptionFixedFee: b.early_redeem_fixed_fee !== null ? Number(b.early_redeem_fixed_fee) : undefined,
        minHoldMonths: b.min_hold_months !== null ? Number(b.min_hold_months) : undefined,
        description: b.description ?? '',
        notes: b.notes ?? undefined,
        compounding: b.symbol === 'EDO' || b.symbol === 'TOS', // fallback if not in DB
      })),
      source: 'https://www.obligacjeskarbowe.pl/',
      isUserOverride: false,
    };
  } catch (error) {
    console.error('Failed to load bond data from Supabase:', error);
    return null;
  }
}