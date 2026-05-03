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
}

// Current NBP reference rate (NBP stopa referencyjna)
// As of 2025: 5.75% (last cut Oct 2023, held since)
export const NBP_REFERENCE_RATE_PCT = 5.75;

// Current estimated CPI for Poland (2025 projection)
// National Bank of Poland projection for 2025: ~4.5%
export const CURRENT_CPI_ESTIMATE_PCT = 4.5;

// Belka tax rate on interest income
export const BELKA_TAX_PCT = 19;

export const OBLIGACJE_CATALOG: ObligacjaBond[] = [
  {
    symbol: "OTS",
    name: "3-miesięczne oszczędnościowe",
    tenorMonths: 3,
    category: "fixed",
    annualRatePct: 5.0,
    earlyRedemptionPenaltyPct: 100, // all interest lost
    minHoldMonths: 1,
    description: "Stałe oprocentowanie przez cały okres. Brak możliwości wcześniejszego wykupu przed upływem 1 m-ca.",
    notes: "Najkrótszy dostępny instrument. Idealne dla płynności.",
  },
  {
    symbol: "ROR",
    name: "12-miesięczne (stopa NBP)",
    tenorMonths: 12,
    category: "nbp_indexed",
    nbpMarginPct: 0.0, // = exactly NBP reference rate
    earlyRedemptionFixedFee: 0.5, // 0.50 zł per 100 zł, deducted from interest
    minHoldMonths: 1,
    description: "Oprocentowanie = stopa referencyjna NBP. Odsetki naliczane miesięcznie.",
    notes: "Zmiana stopy NBP przekłada się na oprocentowanie od następnego miesiąca.",
  },
  {
    symbol: "DOR",
    name: "2-letnie (stopa NBP)",
    tenorMonths: 24,
    category: "nbp_indexed",
    nbpMarginPct: 0.25, // NBP + 0.25pp
    earlyRedemptionFixedFee: 0.7,
    minHoldMonths: 1,
    description: "Oprocentowanie = stopa NBP + 0,25 p.p. Odsetki naliczane miesięcznie, wypłacane co miesiąc.",
    notes: "Lepsza marża niż ROR przy dłuższym zaangażowaniu.",
  },
  {
    symbol: "TOS",
    name: "3-letnie stałoprocentowe",
    tenorMonths: 36,
    category: "fixed",
    annualRatePct: 6.2,
    earlyRedemptionFixedFee: 0.7,
    minHoldMonths: 1,
    description: "Stałe 6,2% przez 3 lata, odsetki kapitalizowane rocznie.",
    notes: "Chronią przed obniżkami stóp NBP.",
  },
  {
    symbol: "COI",
    name: "4-letnie (inflacja CPI)",
    tenorMonths: 48,
    category: "cpi_indexed",
    cpiYear1Pct: 6.55,
    cpiMarginPct: 1.25, // CPI + 1.25pp from year 2
    earlyRedemptionFixedFee: 0.7,
    minHoldMonths: 1,
    description: "Rok 1: 6,55% stałe. Lata 2-4: inflacja CPI + 1,25 p.p. Odsetki wypłacane co roku.",
    notes: "Ochrona przed inflacją od roku 2.",
  },
  {
    symbol: "EDO",
    name: "10-letnie (inflacja CPI)",
    tenorMonths: 120,
    category: "cpi_indexed",
    cpiYear1Pct: 7.0,
    cpiMarginPct: 1.5, // CPI + 1.50pp from year 2
    earlyRedemptionFixedFee: 2.0,
    minHoldMonths: 1,
    description: "Rok 1: 7,0% stałe. Lata 2-10: inflacja CPI + 1,5 p.p. Odsetki kapitalizowane.",
    notes: "Kapitalizacja odsetek = najlepszy efekt procenta składanego przy długim horyzoncie.",
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
    case "nbp_indexed":
      return assumedNbpPct + (bond.nbpMarginPct ?? 0);
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
 * If holdingYears > tenorMonths/12, we assume reinvestment at the same bond (rolled over).
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
  const isEarlyRedemption = holdingYears < tenorYears;
  const yearsRemaining = isEarlyRedemption ? tenorYears - holdingYears : 0;

  const yearly: BondYearlyPoint[] = [];
  let currentValue = initialInvestment;
  let cumulativeGross = 0;

  // For EDO (10-year) bonds: interest is compounded (kapitalizacja)
  const isCompounding = bond.symbol === "EDO";

  for (let y = 1; y <= holdingYears; y++) {
    const annualRate = getBondAnnualRate(bond, y, assumedCpiPct, assumedNbpPct);
    const annualInterestGross = round2(currentValue * (annualRate / 100));
    cumulativeGross += annualInterestGross;

    if (isCompounding) {
      // Reinvest interest into the bond
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
      penaltyApplied: 0,
    });
  }

  // Apply early redemption penalty if applicable
  let penaltyTotal = 0;
  if (isEarlyRedemption && cumulativeGross > 0) {
    if (bond.earlyRedemptionFixedFee !== undefined) {
      // Fixed fee per 100 PLN face value
      penaltyTotal = round2((initialInvestment / 100) * bond.earlyRedemptionFixedFee * holdingYears);
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

  let warningMessage: string | undefined;
  if (isEarlyRedemption) {
    warningMessage = `Okres analizy (${holdingYears} lat) jest krótszy niż czas trwania obligacji (${tenorYears} lat). Stosowany wcześniejszy wykup z karą.`;
  } else if (holdingYears > tenorYears && tenorYears < holdingYears) {
    warningMessage = `Obligacja kończy się po ${tenorYears} latach — zakładamy rolowanie na nowy instrument.`;
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