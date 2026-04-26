/**
 * Polish UoP (umowa o pracę) net salary calculator — 2025 rules.
 *
 * Includes:
 * - ZUS social contributions (employee side): emerytalna 9.76%, rentowa 1.5%, chorobowa 2.45%
 * - Health insurance 9% (no longer deductible from tax since 2022)
 * - Acquisition costs (KUP): standard 250 zł or out-of-town 300 zł
 * - Tax-free monthly allowance (1/12 of 30 000 → 300 zł) when PIT-2 filed
 * - PIT thresholds: 12% up to 120 000 zł, 32% above
 * - PPK (employee 2% default, employer 1.5% default — employer share is taxable income, not deducted from gross for ZUS but added to PIT base)
 * - Custom benefits (LuxMed, Multisport): employer-funded benefits typically increase PIT base (taxable income) and ZUS base
 * - Lunch allowances: ZUS-exempt up to 450 zł/month (2025), PIT-exempt up to 190 zł/day partly — we use 450 zł ZUS-exempt simplification
 * - Remote work flat allowance ("ekwiwalent za pracę zdalną"): fully exempt from PIT and ZUS
 *
 * All amounts are monthly PLN.
 */

export interface SalaryInputs {
  gross: number;                     // base monthly gross
  benefitsTaxable: number;           // sum of taxable benefits (LuxMed, Multisport employer-paid portion)
  lunchAllowance: number;            // monthly lunch allowance (bony żywieniowe)
  remoteAllowance: number;           // ekwiwalent za pracę zdalną (PIT/ZUS exempt)
  ppkEmployeeRate: number;           // % e.g. 2
  ppkEmployerRate: number;           // % e.g. 1.5
  kupType: "standard" | "outOfTown" | "none";
  pit2: boolean;                     // tax-free monthly allowance applied
  outsideFirstThreshold: boolean;    // already exceeded 120k → all income at 32%
  age26Exempt: boolean;              // "ulga dla młodych" — PIT exempt up to 85 528 zł/year
}

export interface SalaryBreakdown {
  gross: number;
  benefitsTaxable: number;
  lunchAllowance: number;
  lunchAllowanceZusExempt: number;   // portion exempt from ZUS (≤450)
  lunchAllowanceZusable: number;     // portion above 450 → ZUS base
  remoteAllowance: number;
  zusBase: number;
  pension: number;                   // 9.76%
  disability: number;                // 1.5%
  sickness: number;                  // 2.45%
  zusTotal: number;
  healthBase: number;
  health: number;                    // 9%
  ppkEmployee: number;
  ppkEmployer: number;               // employer-funded but adds to PIT base
  kup: number;
  taxFreeAllowance: number;          // 300 if PIT-2
  taxBaseRaw: number;                // before rounding
  taxBase: number;                   // rounded to full PLN
  pitGross: number;                  // before tax-free allowance
  pit: number;                       // after tax-free allowance, ≥0
  net: number;
  totalEmployerCost: number;
}

const ZUS_PENSION = 0.0976;
const ZUS_DISABILITY = 0.015;
const ZUS_SICKNESS = 0.0245;
const HEALTH_RATE = 0.09;

const ZUS_PENSION_EMPLOYER = 0.0976;
const ZUS_DISABILITY_EMPLOYER = 0.065;
const ZUS_ACCIDENT = 0.0167; // approx average
const FP = 0.0245; // Fundusz Pracy
const FGSP = 0.001; // Fundusz Gwarantowanych Świadczeń Pracowniczych

const FIRST_THRESHOLD_MONTHLY_TAX_FREE = 300;
const FIRST_RATE = 0.12;
const SECOND_RATE = 0.32;
const LUNCH_ZUS_EXEMPT_LIMIT = 450;

const KUP_STANDARD = 250;
const KUP_OUT_OF_TOWN = 300;

export function calculateSalary(i: SalaryInputs): SalaryBreakdown {
  const gross = Math.max(0, i.gross);
  const benefitsTaxable = Math.max(0, i.benefitsTaxable);
  const lunchAllowance = Math.max(0, i.lunchAllowance);
  const remoteAllowance = Math.max(0, i.remoteAllowance);

  const lunchAllowanceZusExempt = Math.min(lunchAllowance, LUNCH_ZUS_EXEMPT_LIMIT);
  const lunchAllowanceZusable = Math.max(0, lunchAllowance - LUNCH_ZUS_EXEMPT_LIMIT);

  // ZUS base: gross + taxable benefits + lunch portion above limit (remote allowance fully exempt)
  const zusBase = gross + benefitsTaxable + lunchAllowanceZusable;

  const pension = round2(zusBase * ZUS_PENSION);
  const disability = round2(zusBase * ZUS_DISABILITY);
  const sickness = round2(zusBase * ZUS_SICKNESS);
  const zusTotal = round2(pension + disability + sickness);

  // Health base = ZUS base − employee ZUS
  const healthBase = zusBase - zusTotal;
  const health = round2(healthBase * HEALTH_RATE);

  // PPK
  const ppkEmployee = round2(gross * (i.ppkEmployeeRate / 100));
  const ppkEmployer = round2(gross * (i.ppkEmployerRate / 100));

  // KUP
  const kup =
    i.kupType === "standard" ? KUP_STANDARD : i.kupType === "outOfTown" ? KUP_OUT_OF_TOWN : 0;

  // Tax base (employer PPK is taxable income for employee)
  // PIT base = gross + benefits + lunch (full, since lunch counts as income unless specifically exempt;
  // we treat lunch as fully taxable income for simplicity — many programs do too) + employer PPK − ZUS − KUP
  const incomeForPit = gross + benefitsTaxable + lunchAllowance + ppkEmployer;
  const taxBaseRaw = Math.max(0, incomeForPit - zusTotal - kup);
  const taxBase = Math.round(taxBaseRaw);

  const taxFreeAllowance = i.pit2 ? FIRST_THRESHOLD_MONTHLY_TAX_FREE : 0;

  let pitGross: number;
  if (i.age26Exempt) {
    pitGross = 0;
  } else if (i.outsideFirstThreshold) {
    pitGross = taxBase * SECOND_RATE;
  } else {
    pitGross = taxBase * FIRST_RATE;
  }
  const pit = Math.max(0, Math.round(pitGross - taxFreeAllowance));

  // Net = gross − ZUS − health − PPK employee − PIT + non-taxable cash items received in hand
  // Lunch allowance and remote allowance are received by employee. Benefits (LuxMed) are non-cash.
  const net = round2(
    gross - zusTotal - health - ppkEmployee - pit + lunchAllowance + remoteAllowance,
  );

  // Employer cost
  const employerZus = round2(
    zusBase * (ZUS_PENSION_EMPLOYER + ZUS_DISABILITY_EMPLOYER + ZUS_ACCIDENT + FP + FGSP),
  );
  const totalEmployerCost = round2(
    gross + benefitsTaxable + lunchAllowance + remoteAllowance + employerZus + ppkEmployer,
  );

  return {
    gross,
    benefitsTaxable,
    lunchAllowance,
    lunchAllowanceZusExempt,
    lunchAllowanceZusable,
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
    kup,
    taxFreeAllowance,
    taxBaseRaw: round2(taxBaseRaw),
    taxBase,
    pitGross: round2(pitGross),
    pit,
    net,
    totalEmployerCost,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
