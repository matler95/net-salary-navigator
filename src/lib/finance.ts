/**
 * Loan amortization (equal installments / "raty równe"), rental P&L,
 * expense frequency, portfolio projection, real-estate buy-to-let scenarios.
 */

export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function remainingBalance(
  principal: number,
  annualRatePct: number,
  totalMonths: number,
  monthsPaid: number,
): number {
  if (monthsPaid >= totalMonths) return 0;
  const r = annualRatePct / 100 / 12;
  const pmt = monthlyPayment(principal, annualRatePct, totalMonths);
  if (r === 0) return Math.max(0, principal - pmt * monthsPaid);
  const fv =
    principal * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  return Math.max(0, fv);
}

export function loanTotalInterest(
  principal: number,
  annualRatePct: number,
  months: number,
): number {
  return monthlyPayment(principal, annualRatePct, months) * months - principal;
}

/**
 * Build full amortization schedule with optional fixed monthly overpayment.
 * Overpayment shortens the term (we keep the original installment).
 */
export interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  overpayment: number;
  balance: number;
}

export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  monthlyOverpayment = 0,
  overpaymentType: "fixed" | "dynamic" = "fixed",
  insurance = 0,
): AmortRow[] {
  const rows: AmortRow[] = [];
  if (principal <= 0 || months <= 0) return rows;
  const r = annualRatePct / 100 / 12;
  const initialPmt = monthlyPayment(principal, annualRatePct, months);
  const targetTotal = initialPmt + insurance + monthlyOverpayment;

  let balance = principal;
  let m = 0;
  const maxMonths = months + 24; // extra safety
  while (balance > 0.01 && m < maxMonths) {
    m++;
    const interest = balance * r;
    const currentPmt =
      overpaymentType === "dynamic"
        ? monthlyPayment(balance, annualRatePct, months - m + 1)
        : initialPmt;

    let principalPart = currentPmt - interest;
    let overpayment =
      overpaymentType === "dynamic"
        ? Math.max(0, targetTotal - insurance - currentPmt)
        : monthlyOverpayment;

    if (principalPart + overpayment > balance) {
      // last month
      overpayment = Math.max(0, balance - principalPart);
      if (principalPart > balance) {
        principalPart = balance;
        overpayment = 0;
      }
    }
    balance = Math.max(0, balance - principalPart - overpayment);
    rows.push({
      month: m,
      payment: round2(currentPmt + overpayment),
      interest: round2(interest),
      principal: round2(principalPart),
      overpayment: round2(overpayment),
      balance: round2(balance),
    });
    if (balance <= 0.01) break;
  }
  return rows;
}

export function amortizationScheduleDecreasing(
  principal: number,
  annualRatePct: number,
  months: number,
  monthlyOverpayment = 0,
): AmortRow[] {
  const rows: AmortRow[] = [];
  if (principal <= 0 || months <= 0) return rows;
  const r = annualRatePct / 100 / 12;
  let balance = principal;
  const principalRepayment = principal / months;
  let m = 0;
  const maxMonths = months + 24;

  while (balance > 0.01 && m < maxMonths) {
    m++;
    const interest = balance * r;
    let overpayment = monthlyOverpayment;
    if (principalRepayment + overpayment > balance) {
      overpayment = Math.max(0, balance - principalRepayment);
    }
    balance = Math.max(0, balance - principalRepayment - overpayment);
    rows.push({
      month: m,
      payment: round2(principalRepayment + interest + overpayment),
      interest: round2(interest),
      principal: round2(principalRepayment),
      overpayment: round2(overpayment),
      balance: round2(balance),
    });
  }

  return rows;
}

function remainingBalanceWithDecreasingOverpayment(
  principal: number,
  annualRatePct: number,
  months: number,
  targetMonths: number,
  monthlyOverpayment: number,
) {
  const r = annualRatePct / 100 / 12;
  let balance = principal;
  const principalRepayment = principal / months;
  for (let m = 1; m <= targetMonths && balance > 0.001; m++) {
    const interest = balance * r;
    let overpayment = monthlyOverpayment;
    if (principalRepayment + overpayment > balance) {
      overpayment = Math.max(0, balance - principalRepayment);
    }
    balance = Math.max(0, balance - principalRepayment - overpayment);
  }
  return balance;
}

export function calcRequiredOverpayment(s: RealEstateScenario): number {
  const downPayment = s.purchasePrice * (s.downPaymentPct / 100);
  const renovationFinancedPct = Math.max(0, Math.min(100, s.renovationFinancedPct || 0));
  const renovationFinancedAmount = (s.renovationCost * renovationFinancedPct) / 100;
  const loanAmount = Math.max(0, s.purchasePrice - downPayment) + renovationFinancedAmount;
  const months = Math.max(1, s.mortgageYears * 12);
  const targetMonths = Math.max(1, Math.round(s.holdingYears * 12));

  if (loanAmount <= 0 || targetMonths >= months) return 0;

  const balanceAfter = (monthlyOverpayment: number) => {
    if (s.mortgageType === "equal") {
      const schedule = amortizationSchedule(loanAmount, s.mortgageRatePct, months, monthlyOverpayment, "fixed");
      if (schedule.length < targetMonths) return 0;
      return schedule[targetMonths - 1].balance;
    }
    return remainingBalanceWithDecreasingOverpayment(
      loanAmount,
      s.mortgageRatePct,
      months,
      targetMonths,
      monthlyOverpayment,
    );
  };

  if (balanceAfter(0) <= 0) return 0;

  let low = 0;
  let high = loanAmount;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const balance = balanceAfter(mid);
    if (balance > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return round2(high);
}

export interface RentalInput {
  monthlyRent: number;
  monthlyCosts: number;
  monthlyMortgage: number;
  taxRatePct: number;
}

export function rentalCashflow(r: RentalInput) {
  const grossRent = r.monthlyRent;
  const effectiveRent = grossRent;
  const tax = effectiveRent * (r.taxRatePct / 100);
  const cashflow = effectiveRent - r.monthlyCosts - r.monthlyMortgage - tax;
  return {
    grossRent,
    effectiveRent: round2(effectiveRent),
    tax: round2(tax),
    cashflow: round2(cashflow),
    annualCashflow: round2(cashflow * 12),
  };
}

/* ============================================================
   Expense frequency
============================================================ */

export type Frequency = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual" | "oneoff";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: "Miesięcznie",
  bimonthly: "Co 2 miesiące",
  quarterly: "Kwartalnie",
  semiannual: "Co pół roku",
  annual: "Rocznie",
  oneoff: "Jednorazowo",
};

/** Convert any-frequency amount into an equivalent monthly amount. */
export function toMonthly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "monthly":
      return amount;
    case "bimonthly":
      return amount / 2;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "annual":
      return amount / 12;
    case "oneoff":
      return 0;
  }
}

export function toAnnual(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "monthly":
      return amount * 12;
    case "bimonthly":
      return amount * 6;
    case "quarterly":
      return amount * 4;
    case "semiannual":
      return amount * 2;
    case "annual":
      return amount;
    case "oneoff":
      return amount;
  }
}

export interface BaseExpense {
  amount: number;
  frequency: Frequency;
  month?: number;
  months?: number[];
}

/** Get total annual cost for an expense, prioritizing specific months if set. */
export function getExpenseAnnualTotal(e: BaseExpense): number {
  if (e.months && e.months.length > 0) {
    return e.amount * e.months.length;
  }
  return toAnnual(e.amount, e.frequency);
}

/** Get average monthly cost. */
export function getExpenseMonthlyAverage(e: BaseExpense): number {
  if (e.frequency === "oneoff") return 0;
  return getExpenseAnnualTotal(e) / 12;
}

/** Check if an expense occurs in a given month (1-12). */
export function isExpenseInMonth(e: BaseExpense, mIdx: number): boolean {
  if (e.months && e.months.length > 0) {
    return e.months.includes(mIdx);
  }
  if (e.frequency === "monthly") return true;
  if (e.frequency === "oneoff" || e.frequency === "annual") {
    return e.month === mIdx;
  }
  return false;
}

/* ============================================================
   Investment portfolio projection
============================================================ */

export interface PortfolioInputs {
  initial: number;
  monthlyContribution: number;
  years: number;
  annualReturnPct: number;
  annualFeePct: number; // TER (e.g. 0.22 for VWCE)
  annualInflationPct: number; // for real-value series
}

export interface PortfolioPoint {
  year: number;
  contributions: number;
  value: number;
  realValue: number;
  gain: number;
}

export function projectPortfolio(p: PortfolioInputs): PortfolioPoint[] {
  const monthlyReturn = (p.annualReturnPct - p.annualFeePct) / 100 / 12;
  const monthlyInflation = p.annualInflationPct / 100 / 12;
  const months = Math.max(0, Math.round(p.years * 12));
  let value = p.initial;
  let contributions = p.initial;
  const points: PortfolioPoint[] = [
    {
      year: 0,
      contributions: round2(contributions),
      value: round2(value),
      realValue: round2(value),
      gain: 0,
    },
  ];
  for (let m = 1; m <= months; m++) {
    value = value * (1 + monthlyReturn) + p.monthlyContribution;
    contributions += p.monthlyContribution;
    if (m % 12 === 0) {
      const realValue = value / Math.pow(1 + monthlyInflation, m);
      points.push({
        year: m / 12,
        contributions: round2(contributions),
        value: round2(value),
        realValue: round2(realValue),
        gain: round2(value - contributions),
      });
    }
  }
  return points;
}

/* ============================================================
   Buy-to-let real estate scenario
============================================================ */

export interface RealEstateScenario {
  // Purchase
  purchasePrice: number;
  downPaymentPct: number;
  renovationCost: number;
  renovationFinancedPct: number;
  renovationMonths: number;
  tenantSearchMonths: number;
  marketType: "wtórny" | "pierwotny";
  hasAgency: boolean;
  // Mortgage
  mortgageRatePct: number;
  mortgageYears: number;
  mortgageType: "equal" | "decreasing";
  bankCommissionPct: number;
  mortgageInsuranceMonthly: number;
  // Overpayment
  tsoverpaymentEnabled: boolean;
  overpaymentMonthly: number | null;
  // Rent
  monthlyRent: number;
  monthlyCosts: number;
  tenantPaysAdmin: boolean;
  tenantPaysMedia: boolean;
  taxRatePct: number;
  // Long-term
  rentGrowthPct: number;
  appreciationPct: number;
  holdingYears: number;
  sellAtEnd: boolean;
}

export interface RealEstateResult {
  // Upfront
  downPayment: number;
  closingCosts: number;
  totalUpfront: number;
  loanAmount: number;
  monthlyPmt: number;
  totalMortgageCost: number;
  totalInterestPaid: number;
  totalOverpaymentPaid: number;
  // First-year cashflow
  effectiveRent: number;
  monthlyTax: number;
  monthlyCashflow: number;
  annualCashflow: number;
  // Returns
  grossYieldPct: number;
  netYieldPct: number;
  cashOnCashPct: number;
  capRate: number;
  breakEvenMonths: number;
  // Projection
  yearly: RealEstateYearPoint[];
  totalCashflow: number;
  finalEquity: number;
  saleCosts: number;
  netFromSale: number;
  totalReturn: number;
  totalReturnPct: number;
  totalReturnNoSale: number;
  totalReturnNoSalePct: number;
  irrAnnualPct: number;
  totalOperationalCosts: number;
  netOverpaymentCost: number;
  /**
   * Total interest paid on BASELINE schedule (without overpayments) over holdingYears.
   * Used by FlowTab to reconcile the "Jak sprawdzić" section cleanly.
   */
  totalBaselineInterestOverHolding: number;
  /**
   * Total mortgage payments on BASELINE schedule (without overpayments) over holdingYears.
   * Exposed so FlowTab can show the actual baseline capital+interest paid.
   */
  totalBaselineMortgagePayments: number;
  /**
   * Total mortgage payments on ACTUAL schedule (with overpayments) over holdingYears.
   * This is what actually came out of pocket for the mortgage (excl. insurance).
   */
  totalActualMortgagePayments: number;
}

export interface RealEstateYearPoint {
  year: number;
  rent: number;
  cashflow: number;
  cumulativeCashflow: number;
  cumulativePositiveCashflow: number;
  cumulativeNegativeCashflow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  totalValueIfSold: number;
}

export function calculateRealEstate(s: RealEstateScenario): RealEstateResult {
  const downPayment = s.purchasePrice * (s.downPaymentPct / 100);
  const calculatedClosingCostsPct = (s.marketType === "wtórny" ? 2.5 : 0.5) + (s.hasAgency ? 2 : 0);
  const closingCosts = s.purchasePrice * (calculatedClosingCostsPct / 100);
  const renovationFinancedPct = Math.max(0, Math.min(100, s.renovationFinancedPct || 0));
  const renovationFinancedAmount = (s.renovationCost * renovationFinancedPct) / 100;
  const loanAmount = Math.max(0, s.purchasePrice - downPayment) + renovationFinancedAmount;
  const bankCommission = loanAmount * ((s.bankCommissionPct || 0) / 100);
  const totalUpfront = downPayment + s.renovationCost - renovationFinancedAmount + closingCosts + bankCommission;

  const months = Math.max(1, s.mortgageYears * 12);

  // Base monthly mortgage payment (equal installment, no overpayments, no insurance)
  let monthlyPmt = 0;
  if (s.mortgageType === "decreasing") {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const interest = (loanAmount - (loanAmount / months) * (m - 1)) * (s.mortgageRatePct / 100 / 12);
      sum += loanAmount / months + interest;
    }
    monthlyPmt = sum / 12;
  } else {
    monthlyPmt = monthlyPayment(loanAmount, s.mortgageRatePct, months);
  }

  const initialVacancyMonths = Math.max(0, (s.renovationMonths || 0) + (s.tenantSearchMonths || 0));
  const rentedMonthsFirstYear = Math.max(0, 12 - initialVacancyMonths);
  const annualRentFirstYear = s.monthlyRent * rentedMonthsFirstYear;
  const effectiveRent = annualRentFirstYear / 12;
  const monthlyTax = annualRentFirstYear * (s.taxRatePct / 100) / 12;
  const effectiveOverpayment = s.tsoverpaymentEnabled
    ? (s.overpaymentMonthly ?? calcRequiredOverpayment(s))
    : 0;

  // ACTUAL schedule (with overpayments) — drives all cashflow calculations
  const loanSchedule =
    s.mortgageType === "equal"
      ? amortizationSchedule(loanAmount, s.mortgageRatePct, months, effectiveOverpayment, "fixed")
      : amortizationScheduleDecreasing(loanAmount, s.mortgageRatePct, months, effectiveOverpayment);

  // BASELINE schedule (no overpayments) — for comparison / UI reconciliation
  const baselineLoanSchedule =
    s.mortgageType === "equal"
      ? amortizationSchedule(loanAmount, s.mortgageRatePct, months, 0, "fixed")
      : amortizationScheduleDecreasing(loanAmount, s.mortgageRatePct, months, 0);

  // First-year actual average monthly pmt (includes overpayment amounts)
  const firstYearRows = loanSchedule.slice(0, 12);
  const actualMonthlyPmtFirstYear = firstYearRows.length > 0
    ? firstYearRows.reduce((sum, row) => sum + row.payment, 0) / firstYearRows.length
    : 0;

  const monthlyCashflow = effectiveRent - s.monthlyCosts - actualMonthlyPmtFirstYear - (s.mortgageInsuranceMonthly || 0) - monthlyTax;
  const annualCashflow = monthlyCashflow * 12;

  const grossYieldPct = s.purchasePrice > 0 ? (annualRentFirstYear / s.purchasePrice) * 100 : 0;
  const noi = annualRentFirstYear - s.monthlyCosts * 12 - annualRentFirstYear * (s.taxRatePct / 100);
  const netYieldPct = s.purchasePrice > 0 ? (noi / s.purchasePrice) * 100 : 0;
  const cashOnCashPct = totalUpfront > 0 ? (annualCashflow / totalUpfront) * 100 : 0;
  const capRate = s.purchasePrice > 0 ? (noi / s.purchasePrice) * 100 : 0;

  // ── Yearly projection ─────────────────────────────────────────────────
  const yearly: RealEstateYearPoint[] = [];
  let cumulative = 0;
  let cumulativePositive = 0;
  let cumulativeNegative = 0;
  let propertyValue = s.purchasePrice;

  for (let y = 1; y <= s.holdingYears; y++) {
    const rentYear = y === 1
      ? annualRentFirstYear
      : s.monthlyRent * 12 * Math.pow(1 + s.rentGrowthPct / 100, y - 1);
    const taxYear = rentYear * (s.taxRatePct / 100);
    const costsYear = s.monthlyCosts * 12;
    const insuranceYear = (s.mortgageInsuranceMonthly || 0) * 12;

    const startIdx = (y - 1) * 12;
    const endIdx = y * 12;
    const yearRows = loanSchedule.slice(startIdx, endIdx);
    const pmtYear = yearRows.reduce((sum: number, row: AmortRow) => sum + row.payment, 0);

    const cf = rentYear - costsYear - pmtYear - taxYear - insuranceYear;
    cumulative += cf;
    if (cf > 0) cumulativePositive += cf;
    else cumulativeNegative += Math.abs(cf);

    propertyValue = s.purchasePrice * Math.pow(1 + s.appreciationPct / 100, y);
    const loanBalance = yearRows.length > 0
      ? yearRows[yearRows.length - 1].balance
      : Math.max(0, loanSchedule[loanSchedule.length - 1]?.balance ?? 0);
    const equity = propertyValue - loanBalance;

    yearly.push({
      year: y,
      rent: round2(rentYear),
      cashflow: round2(cf),
      cumulativeCashflow: round2(cumulative),
      cumulativePositiveCashflow: round2(cumulativePositive),
      cumulativeNegativeCashflow: round2(cumulativeNegative),
      propertyValue: round2(propertyValue),
      loanBalance: round2(loanBalance),
      equity: round2(equity),
      totalValueIfSold: round2(equity + cumulative),
    });
  }

  // ── Totals ─────────────────────────────────────────────────────────────

  // Interest paid on ACTUAL schedule (holding period only)
  const totalInterestPaid = loanSchedule
    .slice(0, s.holdingYears * 12)
    .reduce((sum: number, row: AmortRow) => sum + row.interest, 0);

  // Overpayments made (holding period only)
  const totalOverpaymentPaid = loanSchedule
    .slice(0, s.holdingYears * 12)
    .reduce((sum: number, row: AmortRow) => sum + row.overpayment, 0);

  // Baseline interest/mortgage over holding period (without overpayments)
  let totalBaselineInterestOverHolding = 0;
  let totalBaselineMortgagePayments = 0;
  for (let y = 1; y <= s.holdingYears; y++) {
    const startIdx = (y - 1) * 12;
    const endIdx = y * 12;
    const baselineYearRows = baselineLoanSchedule.slice(startIdx, endIdx);
    totalBaselineInterestOverHolding += baselineYearRows.reduce((sum: number, row: AmortRow) => sum + row.interest, 0);
    totalBaselineMortgagePayments += baselineYearRows.reduce((sum: number, row: AmortRow) => sum + row.payment, 0);
  }

  // Actual mortgage payments (holding period, with overpayments = capital + interest + overpayment)
  const totalActualMortgagePayments = loanSchedule
    .slice(0, s.holdingYears * 12)
    .reduce((sum: number, row: AmortRow) => sum + row.payment, 0);

  // Interest saved vs baseline
  const interestSaved = totalBaselineInterestOverHolding - totalInterestPaid;
  // Net cost of overpayments = money sent in overpayments - interest saved
  const netOverpaymentCost = Math.max(0, totalOverpaymentPaid - interestSaved);

  const totalInsurancePaid = (s.mortgageInsuranceMonthly || 0) * 12 * s.holdingYears;
  const totalMortgageCost = totalInterestPaid + bankCommission + totalInsurancePaid;

  // Baseline operational costs (for totalOperationalCosts field — informational)
  let totalOperationalCosts = 0;
  for (let y = 1; y <= s.holdingYears; y++) {
    const startIdx = (y - 1) * 12;
    const endIdx = y * 12;
    const baselineYearRows = baselineLoanSchedule.slice(startIdx, endIdx);
    const baselinePmtYear = baselineYearRows.reduce((sum: number, row: AmortRow) => sum + row.payment, 0);
    const rentYear = y === 1
      ? annualRentFirstYear
      : s.monthlyRent * 12 * Math.pow(1 + s.rentGrowthPct / 100, y - 1);
    const taxYear = rentYear * (s.taxRatePct / 100);
    const costsYear = s.monthlyCosts * 12;
    const insuranceYear = (s.mortgageInsuranceMonthly || 0) * 12;
    totalOperationalCosts += costsYear + baselinePmtYear + insuranceYear + taxYear;
  }

  // Break-even
  let beMonths = Infinity;
  if (monthlyCashflow > 0) beMonths = totalUpfront / monthlyCashflow;

  const finalEquity = yearly.length ? yearly[yearly.length - 1].equity : downPayment;
  const totalCashflow = cumulative;
  const saleCosts = s.sellAtEnd ? finalEquity * 0.02 : 0;
  const netFromSale = s.sellAtEnd ? finalEquity - saleCosts : 0;
  const totalReturn = netFromSale + totalCashflow - totalUpfront;
  const totalReturnNoSale = totalCashflow - totalUpfront; // net profit from cashflow only

  // IRR: use simple CAGR on cash invested (totalUpfront only — do NOT add negative cashflow months
  // as those are funded from rent shortfall, not new equity injections)
  const irrAnnualPct = totalUpfront > 0 && s.holdingYears > 0
    ? (Math.pow(
        Math.max(0.0001, (totalUpfront + totalReturn) / totalUpfront),
        1 / s.holdingYears,
      ) - 1) * 100
    : 0;

  const totalReturnPct = totalUpfront > 0 ? (totalReturn / totalUpfront) * 100 : 0;
  const totalReturnNoSalePct = totalUpfront > 0 ? (totalReturnNoSale / totalUpfront) * 100 : 0;

  return {
    downPayment: round2(downPayment),
    closingCosts: round2(closingCosts),
    totalUpfront: round2(totalUpfront),
    loanAmount: round2(loanAmount),
    monthlyPmt: round2(monthlyPmt),
    totalMortgageCost: round2(totalMortgageCost),
    totalInterestPaid: round2(totalInterestPaid),
    totalOverpaymentPaid: round2(totalOverpaymentPaid),
    effectiveRent: round2(effectiveRent),
    monthlyTax: round2(monthlyTax),
    monthlyCashflow: round2(monthlyCashflow),
    annualCashflow: round2(annualCashflow),
    grossYieldPct: round2(grossYieldPct),
    netYieldPct: round2(netYieldPct),
    cashOnCashPct: round2(cashOnCashPct),
    capRate: round2(capRate),
    breakEvenMonths: isFinite(beMonths) ? Math.round(beMonths) : -1,
    yearly,
    totalCashflow: round2(totalCashflow),
    finalEquity: round2(finalEquity),
    saleCosts: round2(saleCosts),
    netFromSale: round2(netFromSale),
    totalReturn: round2(totalReturn),
    totalReturnPct: round2(totalReturnPct),
    totalReturnNoSale: round2(totalReturnNoSale),
    totalReturnNoSalePct: round2(totalReturnNoSalePct),
    irrAnnualPct: round2(irrAnnualPct),
    totalOperationalCosts: round2(totalOperationalCosts),
    netOverpaymentCost: round2(netOverpaymentCost),
    totalBaselineInterestOverHolding: round2(totalBaselineInterestOverHolding),
    totalBaselineMortgagePayments: round2(totalBaselineMortgagePayments),
    totalActualMortgagePayments: round2(totalActualMortgagePayments),
  };
}

/**
 * Minimum monthly rent (gross, from tenant) at which monthly cash-flow = 0.
 */
export function minBreakEvenRent(s: RealEstateScenario, r: RealEstateResult): number {
  const initialVacancyMonths = Math.max(0, (s.renovationMonths || 0) + (s.tenantSearchMonths || 0));
  const monthsRented = Math.max(0, 12 - initialVacancyMonths);
  const effectiveOverpayment = s.tsoverpaymentEnabled
    ? (s.overpaymentMonthly ?? calcRequiredOverpayment(s))
    : 0;
  const totalFixed = r.monthlyPmt + (s.mortgageInsuranceMonthly || 0) + s.monthlyCosts + effectiveOverpayment;
  const factor = monthsRented > 0 ? (monthsRented / 12) * (1 - s.taxRatePct / 100) : 0;
  return factor > 0 ? round2(totalFixed / factor) : 0;
}

/** Qualitative investment verdict based on cashflow + yield + IRR */
export type InvestmentVerdict = "rentowna" | "graniczna" | "kapitalowa" | "ryzykowna";
export function getInvestmentVerdict(r: RealEstateResult): InvestmentVerdict {
  if (r.monthlyCashflow > 0 && r.netYieldPct >= 4) return "rentowna";
  if (r.monthlyCashflow >= -400) return "graniczna";
  if (r.irrAnnualPct >= 5) return "kapitalowa";
  return "ryzykowna";
}

export interface WiborScenario {
  rateDelta: number;
  ratePct: number;
  monthlyPmt: number;
  monthlyCashflow: number;
  pmtDelta: number;
  cashflowDelta: number;
}
export function wiborSensitivity(s: RealEstateScenario, base: RealEstateResult): WiborScenario[] {
  return [-3, -2, -1, 0, 1, 2, 3].map((delta) => {
    const newRate = Math.max(0.1, s.mortgageRatePct + delta);
    const r = calculateRealEstate({ ...s, mortgageRatePct: newRate });
    return {
      rateDelta: delta,
      ratePct: round2(newRate),
      monthlyPmt: r.monthlyPmt,
      monthlyCashflow: r.monthlyCashflow,
      pmtDelta: round2(r.monthlyPmt - base.monthlyPmt),
      cashflowDelta: round2(r.monthlyCashflow - base.monthlyCashflow),
    };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}