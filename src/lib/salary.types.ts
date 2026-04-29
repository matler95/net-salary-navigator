/**
 * Shared types for salary and financial calculations.
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

export type B2BTaxType = "ryczalt" | "liniowy" | "skala";
export type B2BZusType = "full" | "preferential" | "start" | "small";

export interface B2BInputs {
  revenueNet: number;
  taxType: B2BTaxType;
  ryczaltRate: number; // e.g. 12
  expensesNet: number;
  zusType: B2BZusType;
  voluntarySickness: boolean;
  vatRate: number; // e.g. 23
  hasPpk: boolean;
}

export type IncomeType = "UoP" | "B2B";

export interface Income {
  id: string;
  type: IncomeType;
  label: string;
  uopInputs?: SalaryInputs;
  b2bInputs?: B2BInputs;
}

export type Spouse = {
  id: string;
  name: string;
  incomes: Income[];
  assignedUserId?: string;
};

export type GlobalSettings = {
  avgSalaryForecast: number;
  pitThresholdAnnual: number;
  pitFirstRate: number; // in %
  pitSecondRate: number; // in %
  taxFreeAmountAnnual: number;
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

export interface B2BBreakdown {
  revenueNet: number;
  revenueGross: number;
  vat: number;
  expensesNet: number;
  zusBase: number;
  pension: number;
  disability: number;
  sickness: number;
  accident: number;
  laborFund: number;
  zusTotal: number;
  healthBase: number;
  health: number;
  taxBase: number;
  pit: number;
  net: number;
  totalCost: number; // ZusTotal + Health + Pit + Expenses
  annualTaxBase: number;
}
