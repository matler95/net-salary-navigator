/**
 * Polish UoP net salary engine - 2025.
 *
 * Adds autorskie koszty uzyskania przychodu (50% KUP):
 *   - User specifies % of gross treated as honorarium (creative work).
 *   - 50% KUP applies to that portion of income MINUS the ZUS share attributable to it.
 *     (PIT income for that part = grossPart − zusPart, then 50% deducted as KUP.)
 *   - Annual cap: 120 000 PLN of 50% KUP per year (we apply 1/12 = 10 000 PLN monthly cap by default,
 *     toggleable via `autorskiKupCapMonthly`).
 *   - The remaining (non-creative) part still uses standard / out-of-town KUP (or none).
 *
 * Joint filing helper (`computeJointFiling`) averages the couple's annual taxable bases,
 * computes PIT once on the average using both thresholds, then doubles it.
 */

export interface SalaryInputs {
  gross: number;
  benefitsTaxable: number;
  companyCarEnabled: boolean;
  companyCarMode: "statutory" | "manual";
  companyCarStatutoryValue: "250" | "400";
  companyCarManualAmount: number;
  lunchAllowance: number;
  remoteAllowance: number;
  whfDays: number;
  whfDailyRate: number;
  ppkEmployeeRate: number;
  ppkEmployerRate: number;
  kupType: "standard" | "outOfTown" | "none";
  pit2: boolean;
  outsideFirstThreshold: boolean;
  age26Exempt: boolean;
  /** 0–100 - % of `gross` paid as honorarium with 50% KUP. */
  autorskiSharePct: number;
  /** Monthly cap on 50% KUP deduction (default 10 000 = 120 000 / 12). */
  autorskiKupCapMonthly: number;
  // Bonus fields
  bonusMonth: number; // 1-12, 0 means no bonus
  bonusPct: number; // % of annual base salary (12 * gross)
  bonusPaid: boolean;
  bonusOverrideGross: number | null; // manual value if not null
}

export type GlobalSettings = {
  avgSalaryForecast: number;
  pitThresholdAnnual: number;
  pitFirstRate: number; // in % (e.g. 12)
  pitSecondRate: number; // in % (e.g. 32)
  taxFreeAmountAnnual: number;
  regulatoryYear: number;
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  avgSalaryForecast: 8673,
  pitThresholdAnnual: 120000,
  pitFirstRate: 12,
  pitSecondRate: 32,
  taxFreeAmountAnnual: 30000,
  regulatoryYear: 2025,
};

export interface SalaryBreakdown {
  gross: number;
  benefitsTaxable: number;
  companyCarTaxable: number;
  lunchAllowance: number;
  remoteAllowance: number;
  zusBase: number;
  pension: number;
  disability: number;
  sickness: number;
  zusTotal: number;
  healthBase: number;
  health: number;
  ppkEmployee: number;
  ppkEmployer: number;
  kupStandard: number;
  kupAutorski: number;
  kupTotal: number;
  taxFreeAllowance: number;
  taxBase: number;
  pit: number;
  net: number;
  totalEmployerCost: number;
  /** Annual taxable base (×12) - used for second-threshold projection. */
  annualTaxBase: number;
}

const ZUS_PENSION = 0.0976;
const ZUS_DISABILITY = 0.015;
const ZUS_SICKNESS = 0.0245;
const ZUS_EMPLOYEE_TOTAL = ZUS_PENSION + ZUS_DISABILITY + ZUS_SICKNESS; // 0.1371
const HEALTH_RATE = 0.09;

const ZUS_EMPLOYER_RATES = 0.0976 + 0.065 + 0.0167 + 0.0245 + 0.001;

const FIRST_THRESHOLD_ANNUAL = 120000;
const FIRST_THRESHOLD_MONTHLY_TAX_FREE = 300;
const FIRST_RATE = 0.12;
const SECOND_RATE = 0.32;
const LUNCH_ZUS_EXEMPT_LIMIT = 450;
const ZUS_LIMIT_ANNUAL = 253350; // 2025 limit for pension and disability caps

const KUP_STANDARD = 250;
const KUP_OUT_OF_TOWN = 300;

export const DEFAULT_SALARY_INPUTS: SalaryInputs = {
  gross: 10000,
  benefitsTaxable: 0,
  companyCarEnabled: false,
  companyCarMode: "statutory",
  companyCarStatutoryValue: "250",
  companyCarManualAmount: 0,
  lunchAllowance: 0,
  remoteAllowance: 0,
  whfDays: 0,
  whfDailyRate: 0,
  ppkEmployeeRate: 2,
  ppkEmployerRate: 1.5,
  kupType: "standard",
  pit2: true,
  outsideFirstThreshold: false,
  age26Exempt: false,
  autorskiSharePct: 0,
  autorskiKupCapMonthly: 10000,
  bonusMonth: 0,
  bonusPct: 0,
  bonusPaid: true,
  bonusOverrideGross: null,
};

export type IkzeTaxpayerType = "standard" | "b2b";
export type RetirementLimits = {
  year: number;
  ikeAnnualLimit: number;
  ikzeAnnualLimit: number;
  ikzeB2bAnnualLimit: number;
};

const RETIREMENT_LIMITS_BY_YEAR: Record<number, RetirementLimits> = {
  2024: { year: 2024, ikeAnnualLimit: 23472, ikzeAnnualLimit: 9388, ikzeB2bAnnualLimit: 14083.2 },
  2025: {
    year: 2025,
    ikeAnnualLimit: 26019,
    ikzeAnnualLimit: 10407.6,
    ikzeB2bAnnualLimit: 15611.4,
  },
};

export const RETIREMENT_LIMITS_DEFAULT_YEAR = 2025;

export function getRetirementLimits(
  requestedYear: number,
  ikzeTaxpayerType: IkzeTaxpayerType = "standard",
  customLimits?: RetirementLimits[],
): { year: number; ikeAnnualLimit: number; ikzeAnnualLimit: number } {
  // Use custom limits if provided (e.g. from DB)
  const limitsMap: Record<number, RetirementLimits> =
    customLimits && customLimits.length > 0
      ? Object.fromEntries(customLimits.map((l) => [l.year, l]))
      : RETIREMENT_LIMITS_BY_YEAR;

  const availableYears = Object.keys(limitsMap)
    .map(Number)
    .sort((a, b) => a - b);

  if (availableYears.length === 0) {
    // Fallback if absolutely nothing is found
    return { year: requestedYear, ikeAnnualLimit: 26019, ikzeAnnualLimit: 10407.6 };
  }

  const fallbackYear = availableYears[availableYears.length - 1];
  const selectedYear = limitsMap[requestedYear] ? requestedYear : fallbackYear;
  const selected = limitsMap[selectedYear];

  return {
    year: selectedYear,
    ikeAnnualLimit: selected.ikeAnnualLimit,
    ikzeAnnualLimit:
      ikzeTaxpayerType === "b2b" ? selected.ikzeB2bAnnualLimit : selected.ikzeAnnualLimit,
  };
}

// Backward-compatible exports used in older call sites.
const DEFAULT_LIMITS = getRetirementLimits(RETIREMENT_LIMITS_DEFAULT_YEAR, "standard");
export const IKE_LIMIT_ANNUAL = DEFAULT_LIMITS.ikeAnnualLimit;
export const IKZE_LIMIT_ANNUAL = DEFAULT_LIMITS.ikzeAnnualLimit;
export const IKZE_LIMIT_B2B_ANNUAL = getRetirementLimits(
  RETIREMENT_LIMITS_DEFAULT_YEAR,
  "b2b",
).ikzeAnnualLimit;

export function calculateSalary(
  i: SalaryInputs,
  cumulativeZusBaseBefore: number = 0,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): SalaryBreakdown {
  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const ZUS_LIMIT_ANNUAL = settings.avgSalaryForecast * 30;
  const taxFreeAllowanceMonthly = (settings.taxFreeAmountAnnual * FIRST_RATE) / 12;

  const gross = Math.max(0, i.gross);
  const benefitsTaxable = Math.max(0, i.benefitsTaxable);
  const companyCarTaxable = getCompanyCarTaxable(i);
  const lunchAllowance = Math.max(0, i.lunchAllowance);
  const remoteAllowance = Math.max(0, i.remoteAllowance);

  const lunchAllowanceZusable = Math.max(0, lunchAllowance - LUNCH_ZUS_EXEMPT_LIMIT);

  const zusBase = gross + benefitsTaxable + companyCarTaxable + lunchAllowanceZusable;

  // ZUS Limit (30-krotność) applies to pension and disability only
  const remainingLimit = Math.max(0, ZUS_LIMIT_ANNUAL - cumulativeZusBaseBefore);
  const zusBaseForLimited = Math.min(zusBase, remainingLimit);

  const pension = round2(zusBaseForLimited * ZUS_PENSION);
  const disability = round2(zusBaseForLimited * ZUS_DISABILITY);
  const sickness = round2(zusBase * ZUS_SICKNESS); // Sickness is NOT capped
  const zusTotal = round2(pension + disability + sickness);

  const healthBase = zusBase - zusTotal;
  const health = round2(healthBase * HEALTH_RATE);

  const ppkEmployee = round2(gross * (i.ppkEmployeeRate / 100));
  const ppkEmployer = round2(gross * (i.ppkEmployerRate / 100));

  const kupStandardBase =
    i.kupType === "standard" ? KUP_STANDARD : i.kupType === "outOfTown" ? KUP_OUT_OF_TOWN : 0;

  // Autorskie KUP: 50% of (creative-portion gross − ZUS attributable to creative portion)
  const autorskiSharePct = clamp(i.autorskiSharePct, 0, 100);
  const creativeShare = autorskiSharePct / 100;
  // Standard KUP only applies to non-creative part (proportionally)
  const kupStandard = round2(kupStandardBase * (1 - creativeShare));

  const creativeGross = gross * creativeShare;
  const creativeZus = zusTotal * creativeShare;
  const autorskiBase = Math.max(0, creativeGross - creativeZus);
  const autorskiKupRaw = autorskiBase * 0.5;
  const autorskiCap = Math.max(0, i.autorskiKupCapMonthly);
  const kupAutorski = round2(Math.min(autorskiKupRaw, autorskiCap));

  const kupTotal = round2(kupStandard + kupAutorski);

  const taxableLunch = lunchAllowanceZusable;
  const incomeForPit = gross + benefitsTaxable + companyCarTaxable + taxableLunch;
  const taxBaseRaw = Math.max(0, incomeForPit - zusTotal - kupTotal);
  const taxBase = Math.round(taxBaseRaw);

  const taxFreeAllowance = i.pit2 ? FIRST_THRESHOLD_MONTHLY_TAX_FREE : 0;

  let pitGross: number;
  if (i.age26Exempt) pitGross = 0;
  else if (i.outsideFirstThreshold) pitGross = taxBase * SECOND_RATE;
  else pitGross = taxBase * FIRST_RATE;
  const pit = Math.max(0, Math.round(pitGross - taxFreeAllowance));

  const net = round2(
    gross - zusTotal - health - ppkEmployee - pit + lunchAllowance + remoteAllowance,
  );

  const employerPension = round2(zusBaseForLimited * 0.0976);
  const employerDisability = round2(zusBaseForLimited * 0.065);
  const employerOther = round2(zusBase * (0.0167 + 0.0245 + 0.001));
  const employerZus = round2(employerPension + employerDisability + employerOther);

  const totalEmployerCost = round2(
    gross +
      benefitsTaxable +
      companyCarTaxable +
      lunchAllowance +
      remoteAllowance +
      employerZus +
      ppkEmployer,
  );

  return {
    gross,
    benefitsTaxable,
    companyCarTaxable,
    lunchAllowance,
    remoteAllowance,
    zusBase: round2(zusBase),
    pension,
    disability,
    sickness,
    zusTotal,
    healthBase: round2(healthBase),
    health,
    ppkEmployee,
    ppkEmployer,
    kupStandard,
    kupAutorski,
    kupTotal,
    taxBase,
    pit,
    net,
    totalEmployerCost,
    annualTaxBase: round2(taxBase * 12),
    taxFreeAllowance: i.pit2 ? taxFreeAllowanceMonthly : 0,
  };
}

/**
 * Returns the full 12-month breakdown,
 * accounting for threshold crossing and bonuses.
 */
export function calculateAnnualBreakdown(
  i: SalaryInputs,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): SalaryBreakdown[] {
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const taxFreeAllowanceMonthly = (settings.taxFreeAmountAnnual * FIRST_RATE) / 12;

  const months: SalaryBreakdown[] = [];
  let cumulativeTaxBase = 0;
  let cumulativeZusBase = 0;

  for (let m = 1; m <= 12; m++) {
    const currentInputs = { ...i, outsideFirstThreshold: false };
    if (i.bonusMonth === m && i.bonusPaid) {
      const bonusAmount = i.bonusOverrideGross ?? i.gross * 12 * (i.bonusPct / 100);
      currentInputs.gross += bonusAmount;
    }

    const baseCalc = calculateSalary(currentInputs, cumulativeZusBase, settings);

    if (i.age26Exempt || cumulativeTaxBase + baseCalc.taxBase <= FIRST_THRESHOLD_ANNUAL) {
      months.push(baseCalc);
      cumulativeTaxBase += baseCalc.taxBase;
      cumulativeZusBase += baseCalc.zusBase;
    } else if (cumulativeTaxBase >= FIRST_THRESHOLD_ANNUAL) {
      const at32 = calculateSalary(
        { ...currentInputs, outsideFirstThreshold: true },
        cumulativeZusBase,
        settings,
      );
      months.push(at32);
      cumulativeTaxBase += at32.taxBase;
      cumulativeZusBase += at32.zusBase;
    } else {
      // Crossing month: mixed rates
      const baseAt12 = FIRST_THRESHOLD_ANNUAL - cumulativeTaxBase;
      const baseAt32 = baseCalc.taxBase - baseAt12;

      const taxFreeAllowance = i.pit2 ? taxFreeAllowanceMonthly : 0;
      const pitGross = baseAt12 * FIRST_RATE + baseAt32 * SECOND_RATE;
      const pit = Math.max(0, Math.round(pitGross - taxFreeAllowance));
      const net = round2(
        baseCalc.gross -
          baseCalc.zusTotal -
          baseCalc.health -
          baseCalc.ppkEmployee -
          pit +
          baseCalc.lunchAllowance +
          baseCalc.remoteAllowance,
      );

      const crossingMonth = { ...baseCalc, pit, net };
      months.push(crossingMonth);
      cumulativeTaxBase += crossingMonth.taxBase;
      cumulativeZusBase += crossingMonth.zusBase;
    }
  }
  return months;
}

/**
 * Returns the breakdown for a specific month (1-12).
 */
/** Returns the arithmetic average of monthly net salaries over 12 months. */
export function calculateAnnualAverageNet(
  i: SalaryInputs,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): number {
  const months = calculateAnnualBreakdown(i, settings);
  const totalNet = months.reduce((sum, m) => sum + m.net, 0);
  return round2(totalNet / 12);
}

/**
 * Returns the breakdown for a specific month (1-12).
 */
export function calculateSalaryForMonth(
  i: SalaryInputs,
  monthIdx: number,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): SalaryBreakdown {
  const months = calculateAnnualBreakdown(i, settings);
  return months[Math.min(11, Math.max(0, monthIdx - 1))];
}

/** Joint filing: PIT computed on averaged annual base × 2. Returns tax saved vs individual. */
export function computeJointFiling(
  aInputs: SalaryInputs,
  bInputs: SalaryInputs,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): { jointAnnualPit: number; individualAnnualPit: number; savings: number } {
  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const annualTaxFreeAmount = settings.taxFreeAmountAnnual * FIRST_RATE;

  const aBreakdown = calculateAnnualBreakdown(aInputs, settings);
  const bBreakdown = calculateAnnualBreakdown(bInputs, settings);

  const aAnnualBase = aBreakdown.reduce((s, m) => s + m.taxBase, 0);
  const bAnnualBase = bBreakdown.reduce((s, m) => s + m.taxBase, 0);

  const annualPit = (base: number) => {
    const taxable = Math.max(0, base);
    if (taxable <= FIRST_THRESHOLD_ANNUAL) {
      return Math.max(0, taxable * FIRST_RATE - annualTaxFreeAmount);
    }
    const first = FIRST_THRESHOLD_ANNUAL * FIRST_RATE;
    const second = (taxable - FIRST_THRESHOLD_ANNUAL) * SECOND_RATE;
    return Math.max(0, first + second - annualTaxFreeAmount);
  };

  const individualAnnualPit = annualPit(aAnnualBase) + annualPit(bAnnualBase);
  const avgBase = (aAnnualBase + bAnnualBase) / 2;
  const jointAnnualPit = annualPit(avgBase) * 2;

  return {
    jointAnnualPit: round2(jointAnnualPit),
    individualAnnualPit: round2(individualAnnualPit),
    savings: round2(individualAnnualPit - jointAnnualPit),
  };
}

/** Cumulative annual tax base by month - used for second-threshold progression chart. */
export function thresholdProjection(monthlyTaxBase: number): {
  month: number;
  cumulative: number;
  threshold: number;
}[] {
  return Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    cumulative: round2(monthlyTaxBase * (idx + 1)),
    threshold: FIRST_THRESHOLD_ANNUAL,
  }));
}

export const FIRST_THRESHOLD = FIRST_THRESHOLD_ANNUAL;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getCompanyCarTaxable(i: SalaryInputs): number {
  if (!i.companyCarEnabled) return 0;
  if (i.companyCarMode === "manual") return Math.max(0, i.companyCarManualAmount);
  return i.companyCarStatutoryValue === "400" ? 400 : 250;
}

export function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPLN2(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function parseLocaleAmount(raw: string): number {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatLocaleAmount(value: number, decimals: number = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "";
  if (value === 0) return "0";
  // Return the number formatted with up to 'decimals' fractional digits,
  // but removing trailing zeros and the decimal point if it's an integer.
  const s = value.toFixed(decimals);
  if (s.indexOf(".") === -1) return s;
  return s.replace(/\.?0+$/, "").replace(".", ",");
}

export interface IkzeTaxReturn {
  taxReturn: number;
  marginalRate: number; // Base rate before deduction
  annualBase: number;
  breakdown: {
    amountAt32: number;
    amountAt12: number;
    amountAt0: number;
  };
}

export function calculateIkzeTaxReturn(
  inputs: SalaryInputs,
  annualContribution: number,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
  ikzeTaxpayerType: IkzeTaxpayerType = "standard",
  retirementLimits?: RetirementLimits[],
): IkzeTaxReturn {
  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const annualTaxFreeAmount = settings.taxFreeAmountAnnual * FIRST_RATE;

  const breakdown = calculateAnnualBreakdown(inputs, settings);
  const annualBase = breakdown.reduce((s, m) => s + m.taxBase, 0);

  const limits = getRetirementLimits(settings.regulatoryYear, ikzeTaxpayerType, retirementLimits);
  // Cap deduction at IKZE limit for selected year/type.
  const cappedContribution = Math.min(annualContribution, limits.ikzeAnnualLimit);

  const calculateAnnualPit = (base: number) => {
    const taxable = Math.max(0, base);
    if (taxable <= FIRST_THRESHOLD_ANNUAL) {
      return Math.max(0, taxable * FIRST_RATE - annualTaxFreeAmount);
    }
    const first = FIRST_THRESHOLD_ANNUAL * FIRST_RATE;
    const second = (taxable - FIRST_THRESHOLD_ANNUAL) * SECOND_RATE;
    return Math.max(0, first + second - annualTaxFreeAmount);
  };

  const currentPit = calculateAnnualPit(annualBase);
  const newPit = calculateAnnualPit(Math.max(0, annualBase - cappedContribution));
  const taxReturn = Math.max(0, currentPit - newPit);

  let marginalRate = FIRST_RATE;
  if (annualBase <= settings.taxFreeAmountAnnual) {
    marginalRate = 0;
  } else if (annualBase > FIRST_THRESHOLD_ANNUAL) {
    marginalRate = SECOND_RATE;
  }

  // Calculate exactly how much of the contribution fell into each bracket
  let amountAt32 = 0;
  let amountAt12 = 0;
  let amountAt0 = 0;

  // We are deducting 'cappedContribution' from 'annualBase' top-down
  let remainingDeduction = cappedContribution;

  if (annualBase > FIRST_THRESHOLD_ANNUAL) {
    const amountIn32 = annualBase - FIRST_THRESHOLD_ANNUAL;
    const deductedHere = Math.min(amountIn32, remainingDeduction);
    amountAt32 = deductedHere;
    remainingDeduction -= deductedHere;
  }

  if (remainingDeduction > 0) {
    const amountIn12 = Math.min(annualBase, FIRST_THRESHOLD_ANNUAL) - settings.taxFreeAmountAnnual;
    if (amountIn12 > 0) {
      const deductedHere = Math.min(amountIn12, remainingDeduction);
      amountAt12 = deductedHere;
      remainingDeduction -= deductedHere;
    }
  }

  if (remainingDeduction > 0) {
    amountAt0 = remainingDeduction;
  }

  return {
    taxReturn: Math.round(taxReturn * 100) / 100,
    marginalRate,
    annualBase,
    breakdown: {
      amountAt32: Math.round(amountAt32 * 100) / 100,
      amountAt12: Math.round(amountAt12 * 100) / 100,
      amountAt0: Math.round(amountAt0 * 100) / 100,
    },
  };
}

export interface IkeIkzeComparisonResult {
  ike: {
    finalPot: number;
    totalContributions: number;
    taxPaid: number;
    netPayout: number;
    annualContributionCapped: number;
    annualLimit: number;
    isCapped: boolean;
  };
  ikze: {
    finalPot: number;
    totalContributions: number;
    taxPaid: number;
    netPayout: number;
    reinvestedReliefPot: number;
    reinvestedReliefTotalTax: number;
    totalNet: number;
    annualContributionCapped: number;
    annualLimit: number;
    isCapped: boolean;
  };
  winner: "IKE" | "IKZE" | "REMIS";
  difference: number;
  isEarlyWithdrawalIke: boolean;
  isEarlyWithdrawalIkze: boolean;
}

export type RetirementWithdrawalEligibility = {
  contributionYearsAtWithdrawal: number;
  qualifiesIkeTaxExemption: boolean;
  qualifiesIkzeFlatTax: boolean;
  isEarlyWithdrawalIke: boolean;
  isEarlyWithdrawalIkze: boolean;
};

/**
 * Simplified legal qualification model for withdrawal tax treatment.
 * - IKE: tax exemption when withdrawal age >= 60 and 5+ contribution years.
 * - IKZE: 10% flat tax when withdrawal age >= 65 and 5+ contribution years.
 */
export function evaluateRetirementWithdrawalEligibility(
  withdrawalAge: number,
  contributionYearsAtWithdrawal: number,
): RetirementWithdrawalEligibility {
  const years = Math.max(0, contributionYearsAtWithdrawal);
  const meetsFiveYearRule = years >= 5;
  const qualifiesIkeTaxExemption = withdrawalAge >= 60 && meetsFiveYearRule;
  const qualifiesIkzeFlatTax = withdrawalAge >= 65 && meetsFiveYearRule;

  return {
    contributionYearsAtWithdrawal: years,
    qualifiesIkeTaxExemption,
    qualifiesIkzeFlatTax,
    isEarlyWithdrawalIke: !qualifiesIkeTaxExemption,
    isEarlyWithdrawalIkze: !qualifiesIkzeFlatTax,
  };
}

export function compareIkeVsIkze(
  monthlyContribution: number,
  existingIke: number,
  existingIkze: number,
  years: number,
  annualReturnPct: number,
  annualTaxReturn: number, // Tax relief from IKZE
  annualBase: number, // Their current yearly salary base
  isEarlyWithdrawalIke: boolean,
  isEarlyWithdrawalIkze: boolean,
  reinvestRelief: boolean = false,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
  ikzeTaxpayerType: IkzeTaxpayerType = "standard",
  retirementLimits?: RetirementLimits[],
): IkeIkzeComparisonResult {
  const limits = getRetirementLimits(settings.regulatoryYear, ikzeTaxpayerType, retirementLimits);
  const monthlyRate = annualReturnPct / 100 / 12;
  const annualRate = annualReturnPct / 100;
  const months = years * 12;

  const ikeMonthlyLimit = limits.ikeAnnualLimit / 12;
  const ikzeMonthlyLimit = limits.ikzeAnnualLimit / 12;

  // --- IKE ---
  // Cap contribution at IKE limit, ignore surplus per user request (no brokerage assumption)
  const ikeMonthlyInLimit = Math.min(monthlyContribution, ikeMonthlyLimit);

  const ikeStartingFV = existingIke * Math.pow(1 + monthlyRate, months);
  let ikeContributionsFV = 0;
  if (monthlyRate > 0) {
    ikeContributionsFV =
      ikeMonthlyInLimit * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  } else {
    ikeContributionsFV = ikeMonthlyInLimit * months;
  }
  const ikeFinalPot = ikeStartingFV + ikeContributionsFV;
  const ikeTotalContributions = existingIke + ikeMonthlyInLimit * months;
  const ikeProfit = Math.max(0, ikeFinalPot - ikeTotalContributions);

  let ikeTaxPaid = 0;
  if (isEarlyWithdrawalIke) {
    ikeTaxPaid = ikeProfit * 0.19; // 19% Belka tax on profit
  }
  const ikeNetPayout = ikeFinalPot - ikeTaxPaid;

  // --- IKZE ---
  // Cap contribution at IKZE limit, ignore surplus per user request (no brokerage assumption)
  const ikzeMonthlyInLimit = Math.min(monthlyContribution, ikzeMonthlyLimit);

  const ikzeStartingFV = existingIkze * Math.pow(1 + monthlyRate, months);
  let ikzeContributionsFV = 0;
  if (monthlyRate > 0) {
    ikzeContributionsFV =
      ikzeMonthlyInLimit * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  } else {
    ikzeContributionsFV = ikzeMonthlyInLimit * months;
  }
  const ikzeFinalPot = ikzeStartingFV + ikzeContributionsFV;
  const ikzeTotalContributions = existingIkze + ikzeMonthlyInLimit * months;

  let ikzeTaxPaid = 0;
  if (isEarlyWithdrawalIkze) {
    const calculateAnnualPit = (base: number) => {
      const FIRST_RATE = settings.pitFirstRate / 100;
      const SECOND_RATE = settings.pitSecondRate / 100;
      const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
      const annualTaxFreeAmount = settings.taxFreeAmountAnnual * FIRST_RATE;
      const taxable = Math.max(0, base);
      if (taxable <= FIRST_THRESHOLD_ANNUAL) {
        return Math.max(0, taxable * FIRST_RATE - annualTaxFreeAmount);
      }
      const first = FIRST_THRESHOLD_ANNUAL * FIRST_RATE;
      const second = (taxable - FIRST_THRESHOLD_ANNUAL) * SECOND_RATE;
      return Math.max(0, first + second - annualTaxFreeAmount);
    };

    const normalPit = calculateAnnualPit(annualBase);
    const earlyWithdrawalPit = calculateAnnualPit(annualBase + ikzeFinalPot);
    ikzeTaxPaid = earlyWithdrawalPit - normalPit;
  } else {
    ikzeTaxPaid = ikzeFinalPot * 0.1; // 10% flat
  }
  const ikzeNetPayout = ikzeFinalPot - ikzeTaxPaid;

  // --- Reinvested Tax Relief (IKZE) ---
  // Note: annualTaxReturn is already capped at limit in calculateIkzeTaxReturn
  let reinvestedReliefPot = 0;
  let reinvestedReliefTotalTax = 0;

  if (reinvestRelief) {
    let reliefFV = 0;
    for (let y = 0; y < years; y++) {
      reliefFV = (reliefFV + annualTaxReturn) * (1 + annualRate);
    }
    const reliefCap = annualTaxReturn * years;
    reinvestedReliefTotalTax = Math.max(0, reliefFV - reliefCap) * 0.19;
    reinvestedReliefPot = reliefFV - reinvestedReliefTotalTax;
  } else {
    reinvestedReliefPot = annualTaxReturn * years;
    reinvestedReliefTotalTax = 0;
  }

  const ikzeTotalNet = ikzeNetPayout + reinvestedReliefPot;

  let winner: "IKE" | "IKZE" | "REMIS" = "REMIS";
  if (ikeNetPayout > ikzeTotalNet + 1) winner = "IKE";
  else if (ikzeTotalNet > ikeNetPayout + 1) winner = "IKZE";

  return {
    ike: {
      finalPot: Math.round(ikeFinalPot * 100) / 100,
      totalContributions: Math.round(ikeTotalContributions * 100) / 100,
      taxPaid: Math.round(ikeTaxPaid * 100) / 100,
      netPayout: Math.round(ikeNetPayout * 100) / 100,
      annualContributionCapped: Math.round(ikeMonthlyInLimit * 12 * 100) / 100,
      annualLimit: limits.ikeAnnualLimit,
      isCapped: monthlyContribution * 12 > limits.ikeAnnualLimit,
    },
    ikze: {
      finalPot: Math.round(ikzeFinalPot * 100) / 100,
      totalContributions: Math.round(ikzeTotalContributions * 100) / 100,
      taxPaid: Math.round(ikzeTaxPaid * 100) / 100,
      netPayout: Math.round(ikzeNetPayout * 100) / 100,
      reinvestedReliefPot: Math.round(reinvestedReliefPot * 100) / 100,
      reinvestedReliefTotalTax: Math.round(reinvestedReliefTotalTax * 100) / 100,
      totalNet: Math.round(ikzeTotalNet * 100) / 100,
      annualContributionCapped: Math.round(ikzeMonthlyInLimit * 12 * 100) / 100,
      annualLimit: limits.ikzeAnnualLimit,
      isCapped: monthlyContribution * 12 > limits.ikzeAnnualLimit,
    },
    winner,
    difference: Math.round(Math.abs(ikeNetPayout - ikzeTotalNet) * 100) / 100,
    isEarlyWithdrawalIke,
    isEarlyWithdrawalIkze,
  };
}
