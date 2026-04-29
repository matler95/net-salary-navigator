/**
 * Polish UoP and B2B net salary engine - 2026.
 */

import {
  type SalaryInputs,
  type B2BInputs,
  type Income,
  type Spouse,
  type GlobalSettings,
  type SalaryBreakdown,
  type B2BBreakdown,
} from "./salary.types";

export * from "./salary.types";

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  avgSalaryForecast: 8673,
  pitThresholdAnnual: 120000,
  pitFirstRate: 12,
  pitSecondRate: 32,
  taxFreeAmountAnnual: 30000,
};

const ZUS_PENSION = 0.0976;
const ZUS_DISABILITY = 0.015;
const ZUS_SICKNESS = 0.0245;
const HEALTH_RATE = 0.09;

const KUP_STANDARD = 250;
const KUP_OUT_OF_TOWN = 300;

// B2B 2026 Constants
const B2B_ZUS_BASE_FULL = 5652.60;
const B2B_MIN_WAGE_2026 = 4806;
const B2B_ZUS_BASE_PREFERENTIAL = B2B_MIN_WAGE_2026 * 0.3; // 1441.80

const B2B_ZUS_PENSION = 0.1952;
const B2B_ZUS_DISABILITY = 0.08;
const B2B_ZUS_SICKNESS = 0.0245;
const B2B_ZUS_ACCIDENT = 0.0167;
const B2B_ZUS_LABOR_FUND = 0.0245;

const B2B_HEALTH_RYCZALT_BASE = 9228.66; // Based on search 2026 results
const B2B_LINIOWY_PIT = 0.19;
const B2B_LINIOWY_HEALTH_LIMIT = 12900; // 2025/2026 limit

const LUNCH_ZUS_EXEMPT_LIMIT = 450;

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

export const DEFAULT_B2B_INPUTS: B2BInputs = {
  revenueNet: 15000,
  taxType: "ryczalt",
  ryczaltRate: 12,
  expensesNet: 0,
  zusType: "full",
  voluntarySickness: true,
  vatRate: 23,
  hasPpk: false,
};

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

  const remainingLimit = Math.max(0, ZUS_LIMIT_ANNUAL - cumulativeZusBaseBefore);
  const zusBaseForLimited = Math.min(zusBase, remainingLimit);

  const pension = round2(zusBaseForLimited * ZUS_PENSION);
  const disability = round2(zusBaseForLimited * ZUS_DISABILITY);
  const sickness = round2(zusBase * ZUS_SICKNESS);
  const zusTotal = round2(pension + disability + sickness);

  const healthBase = zusBase - zusTotal;
  const health = round2(healthBase * HEALTH_RATE);

  const ppkEmployee = round2(gross * (i.ppkEmployeeRate / 100));
  const ppkEmployer = round2(gross * (i.ppkEmployerRate / 100));

  const kupStandardBase =
    i.kupType === "standard" ? KUP_STANDARD : i.kupType === "outOfTown" ? KUP_OUT_OF_TOWN : 0;

  const autorskiSharePct = clamp(i.autorskiSharePct, 0, 100);
  const creativeShare = autorskiSharePct / 100;
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

export function calculateB2B(
  i: B2BInputs,
  cumulativeRevenueBefore: number = 0,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): B2BBreakdown {
  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const taxFreeAllowanceAnnual = settings.taxFreeAmountAnnual;

  const revenueNet = Math.max(0, i.revenueNet);
  const expensesNet = Math.max(0, i.expensesNet);
  const vat = round2(revenueNet * (i.vatRate / 100));
  const revenueGross = round2(revenueNet + vat);

  // Social Insurance (ZUS)
  let zusBase = 0;
  if (i.zusType === "full") zusBase = B2B_ZUS_BASE_FULL;
  else if (i.zusType === "preferential") zusBase = B2B_ZUS_BASE_PREFERENTIAL;
  else if (i.zusType === "small") {
    zusBase = (B2B_ZUS_BASE_FULL + B2B_ZUS_BASE_PREFERENTIAL) / 2;
  }

  const pension = i.zusType !== "start" ? round2(zusBase * B2B_ZUS_PENSION) : 0;
  const disability = i.zusType !== "start" ? round2(zusBase * B2B_ZUS_DISABILITY) : 0;
  const sickness = i.zusType !== "start" && i.voluntarySickness ? round2(zusBase * B2B_ZUS_SICKNESS) : 0;
  const accident = i.zusType !== "start" ? round2(zusBase * B2B_ZUS_ACCIDENT) : 0;
  const laborFund = i.zusType === "full" ? round2(zusBase * B2B_ZUS_LABOR_FUND) : 0;

  const zusTotal = round2(pension + disability + sickness + accident + laborFund);

  // Health Insurance
  let health = 0;
  let healthBase = 0;
  const currentAnnualRevenue = cumulativeRevenueBefore + revenueNet;

  if (i.taxType === "ryczalt") {
    if (currentAnnualRevenue <= 60000) health = 498.35;
    else if (currentAnnualRevenue <= 300000) health = 830.58;
    else health = 1495.04;
    healthBase = health / 0.09;
  } else if (i.taxType === "liniowy") {
    healthBase = Math.max(0, revenueNet - expensesNet - zusTotal);
    health = Math.max(432.54, round2(healthBase * 0.049));
  } else {
    healthBase = Math.max(0, revenueNet - expensesNet - zusTotal);
    health = Math.max(432.54, round2(healthBase * 0.09));
  }

  // Tax (PIT)
  let pit = 0;
  let taxBase = 0;

  if (i.taxType === "ryczalt") {
    const healthDeduction = health * 0.5;
    taxBase = Math.max(0, Math.round(revenueNet - healthDeduction));
    pit = Math.round(taxBase * (i.ryczaltRate / 100));
  } else if (i.taxType === "liniowy") {
    const incomeBeforeHealthDeduction = Math.max(0, revenueNet - expensesNet - zusTotal);
    taxBase = Math.max(0, Math.round(incomeBeforeHealthDeduction - Math.min(health, B2B_LINIOWY_HEALTH_LIMIT / 12)));
    pit = Math.round(taxBase * B2B_LINIOWY_PIT);
  } else {
    taxBase = Math.round(Math.max(0, revenueNet - expensesNet - zusTotal));
    const annualBase = taxBase * 12;
    const annualPit = calculateAnnualPit(annualBase, taxFreeAllowanceAnnual, FIRST_THRESHOLD_ANNUAL, FIRST_RATE, SECOND_RATE);
    pit = Math.round(annualPit / 12);
  }

  const net = round2(revenueNet - zusTotal - health - pit - expensesNet);
  const totalCost = round2(zusTotal + health + pit + expensesNet);

  return {
    revenueNet,
    revenueGross,
    vat,
    expensesNet,
    zusBase,
    pension,
    disability,
    sickness,
    accident,
    laborFund,
    zusTotal,
    healthBase,
    health,
    taxBase,
    pit,
    net,
    totalCost,
    annualTaxBase: taxBase * 12,
  };
}

function calculateAnnualPit(
  annualBase: number,
  taxFreeAmount: number,
  threshold: number,
  rate1: number,
  rate2: number
): number {
  if (annualBase <= threshold) {
    return Math.max(0, annualBase * rate1 - (taxFreeAmount * rate1));
  }
  const pit1 = threshold * rate1 - (taxFreeAmount * rate1);
  const pit2 = (annualBase - threshold) * rate2;
  return Math.max(0, pit1 + pit2);
}

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

export function calculateIncomeAnnualBreakdown(
  inc: Income,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): (SalaryBreakdown | B2BBreakdown)[] {
  if (inc.type === "UoP" && inc.uopInputs) {
    return calculateAnnualBreakdown(inc.uopInputs, settings);
  } else if (inc.type === "B2B" && inc.b2bInputs) {
    const months: B2BBreakdown[] = [];
    let cumulativeRevenue = 0;
    for (let m = 1; m <= 12; m++) {
      const calc = calculateB2B(inc.b2bInputs, cumulativeRevenue, settings);
      months.push(calc);
      cumulativeRevenue += calc.revenueNet;
    }
    return months;
  }
  return [];
}

export function calculateMemberAnnualAverageNet(
  spouse: Spouse,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): number {
  const annual = calculateSpouseAnnualBreakdown(spouse, settings);
  const totalNet = annual.reduce((sum, m) => sum + m.net, 0);
  return round2(totalNet / 12);
}

export function calculateSpouseAnnualBreakdown(
  spouse: Spouse,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): (SalaryBreakdown | B2BBreakdown)[] {
  if (!spouse.incomes || spouse.incomes.length === 0) {
    return Array.from({ length: 12 }, () => ({ net: 0, taxBase: 0 } as any));
  }

  const result = Array.from({ length: 12 }, () => ({
    gross: 0,
    revenueNet: 0,
    net: 0,
    taxBase: 0,
    zusTotal: 0,
    health: 0,
    pit: 0,
  } as any));

  for (const inc of spouse.incomes) {
    const incMonths = calculateIncomeAnnualBreakdown(inc, settings);
    incMonths.forEach((m, idx) => {
      result[idx].net += m.net;
      result[idx].taxBase += m.taxBase;
      result[idx].zusTotal += m.zusTotal;
      result[idx].health += m.health;
      result[idx].pit += m.pit;
      if ("gross" in m) result[idx].gross += m.gross;
      if ("revenueNet" in m) result[idx].revenueNet += m.revenueNet;
    });
  }

  return result;
}

export function calculateSpouseForMonth(
  spouse: Spouse,
  monthIdx: number,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): SalaryBreakdown | B2BBreakdown {
  const annual = calculateSpouseAnnualBreakdown(spouse, settings);
  return annual[Math.min(11, Math.max(0, monthIdx - 1))];
}

export function isEligibleForJointFiling(spouse: Spouse): boolean {
  if (!spouse.incomes) return true;
  return !spouse.incomes.some(inc => 
    inc.type === "B2B" && inc.b2bInputs && (inc.b2bInputs.taxType === "ryczalt" || inc.b2bInputs.taxType === "liniowy")
  );
}

export function calculateSalaryForMonth(
  i: SalaryInputs,
  monthIdx: number,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): SalaryBreakdown {
  const months = calculateAnnualBreakdown(i, settings);
  return months[Math.min(11, Math.max(0, monthIdx - 1))];
}

export function computeJointFiling(
  aMember: Spouse,
  bMember: Spouse,
  settings: GlobalSettings = DEFAULT_GLOBAL_SETTINGS,
): { jointAnnualPit: number; individualAnnualPit: number; savings: number } | null {
  if (!isEligibleForJointFiling(aMember) || !isEligibleForJointFiling(bMember)) return null;

  const FIRST_RATE = settings.pitFirstRate / 100;
  const SECOND_RATE = settings.pitSecondRate / 100;
  const FIRST_THRESHOLD_ANNUAL = settings.pitThresholdAnnual;
  const annualTaxFreeAmount = settings.taxFreeAmountAnnual * FIRST_RATE;

  const getAnnualBase = (spouse: Spouse) => {
    let totalBase = 0;
    for (const inc of spouse.incomes) {
      const months = calculateIncomeAnnualBreakdown(inc, settings);
      totalBase += months.reduce((sum, m) => sum + m.taxBase, 0);
    }
    return totalBase;
  };

  const aAnnualBase = getAnnualBase(aMember);
  const bAnnualBase = getAnnualBase(bMember);

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

export function thresholdProjection(monthlyTaxBase: number, threshold: number): {
  month: number;
  cumulative: number;
  threshold: number;
}[] {
  return Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    cumulative: round2(monthlyTaxBase * (idx + 1)),
    threshold,
  }));
}

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
  const s = value.toFixed(decimals);
  if (s.indexOf(".") === -1) return s;
  return s.replace(/\.?0+$/, "").replace(".", ",");
}
