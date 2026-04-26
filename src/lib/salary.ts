/**
 * Polish UoP net salary engine — 2025.
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
  /** 0–100 — % of `gross` paid as honorarium with 50% KUP. */
  autorskiSharePct: number;
  /** Monthly cap on 50% KUP deduction (default 10 000 = 120 000 / 12). */
  autorskiKupCapMonthly: number;
}

export interface SalaryBreakdown {
  gross: number;
  benefitsTaxable: number;
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
  /** Annual taxable base (×12) — used for second-threshold projection. */
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

const KUP_STANDARD = 250;
const KUP_OUT_OF_TOWN = 300;

export const DEFAULT_SALARY_INPUTS: SalaryInputs = {
  gross: 10000,
  benefitsTaxable: 0,
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
};

export function calculateSalary(i: SalaryInputs): SalaryBreakdown {
  const gross = Math.max(0, i.gross);
  const benefitsTaxable = Math.max(0, i.benefitsTaxable);
  const lunchAllowance = Math.max(0, i.lunchAllowance);
  const remoteAllowance = Math.max(0, i.remoteAllowance);

  const lunchAllowanceZusable = Math.max(0, lunchAllowance - LUNCH_ZUS_EXEMPT_LIMIT);

  const zusBase = gross + benefitsTaxable + lunchAllowanceZusable;
  const pension = round2(zusBase * ZUS_PENSION);
  const disability = round2(zusBase * ZUS_DISABILITY);
  const sickness = round2(zusBase * ZUS_SICKNESS);
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
  const incomeForPit = gross + benefitsTaxable + taxableLunch;
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

  const employerZus = round2(zusBase * ZUS_EMPLOYER_RATES);
  const totalEmployerCost = round2(
    gross + benefitsTaxable + lunchAllowance + remoteAllowance + employerZus + ppkEmployer,
  );

  return {
    gross,
    benefitsTaxable,
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
    taxFreeAllowance,
    taxBase,
    pit,
    net,
    totalEmployerCost,
    annualTaxBase: round2(taxBase * 12),
  };
}

/** Joint filing: PIT computed on averaged annual base × 2. Returns tax saved vs individual. */
export function computeJointFiling(
  a: SalaryBreakdown,
  b: SalaryBreakdown,
): { jointAnnualPit: number; individualAnnualPit: number; savings: number } {
  const annualTaxFree = 30000;

  const annualPit = (base: number) => {
    const taxable = Math.max(0, base);
    if (taxable <= FIRST_THRESHOLD_ANNUAL) {
      return Math.max(0, taxable * FIRST_RATE - annualTaxFree * FIRST_RATE);
    }
    const first = FIRST_THRESHOLD_ANNUAL * FIRST_RATE;
    const second = (taxable - FIRST_THRESHOLD_ANNUAL) * SECOND_RATE;
    return Math.max(0, first + second - annualTaxFree * FIRST_RATE);
  };

  const individualAnnualPit = annualPit(a.annualTaxBase) + annualPit(b.annualTaxBase);
  const avgBase = (a.annualTaxBase + b.annualTaxBase) / 2;
  const jointAnnualPit = annualPit(avgBase) * 2;

  return {
    jointAnnualPit: round2(jointAnnualPit),
    individualAnnualPit: round2(individualAnnualPit),
    savings: round2(individualAnnualPit - jointAnnualPit),
  };
}

/** Cumulative annual tax base by month — used for second-threshold progression chart. */
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
