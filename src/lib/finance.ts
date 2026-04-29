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
  // For other frequencies, if no specific months are set, we might not know.
  // But typically they should have specific months now.
  // Fallback to false or average? For cashflow views, we need specific months.
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
  downPaymentPct: number; // e.g. 20
  renovationCost: number;
  marketType: "wtórny" | "pierwotny";
  hasAgency: boolean;
  // Mortgage
  mortgageRatePct: number; // annual %
  mortgageYears: number;
  mortgageType: "equal" | "decreasing";
  bankCommissionPct: number; // bank commission upfront %
  mortgageInsuranceMonthly: number; // monthly life/property insurance required by bank
  // Rent
  monthlyRent: number;
  monthlyCosts: number; // czynsz admin., zarządzanie, ubezpieczenie /m-c
  taxRatePct: number; // 8.5% ryczałt
  // Long-term
  rentGrowthPct: number; // annual %
  appreciationPct: number; // annual property appreciation %
  holdingYears: number;
}

export interface RealEstateResult {
  // Upfront
  downPayment: number;
  closingCosts: number;
  totalUpfront: number; // down + reno + closing
  loanAmount: number;
  monthlyPmt: number;
  totalMortgageCost: number; // total interest + commission + insurance over holdingYears
  totalInterestPaid: number; // total interest over holdingYears
  // First-year cashflow
  effectiveRent: number;
  monthlyTax: number;
  monthlyCashflow: number;
  annualCashflow: number;
  // Returns
  grossYieldPct: number; // gross rent / purchase price
  netYieldPct: number; // (rent − costs − tax) / price
  cashOnCashPct: number; // annual cashflow / cash invested
  capRate: number; // NOI / property value
  breakEvenMonths: number; // months for cumulative cashflow + appreciation to equal upfront
  // 10-yr (or holdingYears) projection
  yearly: RealEstateYearPoint[];
  totalCashflow: number;
  finalEquity: number;
  totalReturn: number; // cashflow + (final equity − upfront)
  totalReturnPct: number; // % of upfront
  irrAnnualPct: number; // approximate IRR
}

export interface RealEstateYearPoint {
  year: number;
  rent: number;
  cashflow: number;
  cumulativeCashflow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  totalValueIfSold: number;
}

export function calculateRealEstate(s: RealEstateScenario): RealEstateResult {
  const downPayment = s.purchasePrice * (s.downPaymentPct / 100);
  const calculatedClosingCostsPct = (s.marketType === "wtórny" ? 2.5 : 0.5) + (s.hasAgency ? 2 : 0);
  const closingCosts = s.purchasePrice * (calculatedClosingCostsPct / 100);
  const loanAmount = Math.max(0, s.purchasePrice - downPayment);
  const bankCommission = loanAmount * ((s.bankCommissionPct || 0) / 100);
  const totalUpfront = downPayment + s.renovationCost + closingCosts + bankCommission;

  const months = Math.max(1, s.mortgageYears * 12);

  // Calculate average monthly mortgage payment for the first year (for yield/CF display)
  let monthlyPmt = 0;
  if (s.mortgageType === "decreasing") {
    // Average of first 12 months for decreasing installments
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const interest = (loanAmount - (loanAmount / months) * (m - 1)) * (s.mortgageRatePct / 100 / 12);
      sum += loanAmount / months + interest;
    }
    monthlyPmt = sum / 12;
  } else {
    monthlyPmt = monthlyPayment(loanAmount, s.mortgageRatePct, months);
  }

  // Total cost including insurance
  const totalMonthlyMortgageCost = monthlyPmt + (s.mortgageInsuranceMonthly || 0);

  const effectiveRent = s.monthlyRent;
  const monthlyTax = effectiveRent * (s.taxRatePct / 100);
  const monthlyCashflow = effectiveRent - s.monthlyCosts - totalMonthlyMortgageCost - monthlyTax;
  const annualCashflow = monthlyCashflow * 12;

  const grossYieldPct = s.purchasePrice > 0 ? ((s.monthlyRent * 12) / s.purchasePrice) * 100 : 0;
  const noi = (effectiveRent - s.monthlyCosts - monthlyTax) * 12;
  const netYieldPct = s.purchasePrice > 0 ? (noi / s.purchasePrice) * 100 : 0;
  const cashOnCashPct = totalUpfront > 0 ? (annualCashflow / totalUpfront) * 100 : 0;
  const capRate = s.purchasePrice > 0 ? (noi / s.purchasePrice) * 100 : 0;

  // Yearly projection
  const yearly: RealEstateYearPoint[] = [];
  let cumulative = 0;
  let propertyValue = s.purchasePrice;
  for (let y = 1; y <= s.holdingYears; y++) {
    const rentYear = s.monthlyRent * 12 * Math.pow(1 + s.rentGrowthPct / 100, y - 1);
    const effectiveYear = rentYear;
    const taxYear = effectiveYear * (s.taxRatePct / 100);
    const costsYear = s.monthlyCosts * 12;
    const insuranceYear = (s.mortgageInsuranceMonthly || 0) * 12;

    let pmtYear = 0;
    if (s.mortgageType === "decreasing") {
      // Sum installments for months (y-1)*12 + 1 to y*12
      for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
        if (m > months) break;
        const interest = Math.max(0, loanAmount - (loanAmount / months) * (m - 1)) * (s.mortgageRatePct / 100 / 12);
        pmtYear += loanAmount / months + interest;
      }
    } else {
      pmtYear = monthlyPmt * 12;
    }

    const cf = effectiveYear - costsYear - pmtYear - taxYear - insuranceYear;
    cumulative += cf;
    propertyValue = s.purchasePrice * Math.pow(1 + s.appreciationPct / 100, y);
    let loanBalance = 0;
    if (s.mortgageType === "decreasing") {
      loanBalance = Math.max(0, loanAmount - (loanAmount / months) * Math.min(y * 12, months));
    } else {
      loanBalance = remainingBalance(
        loanAmount,
        s.mortgageRatePct,
        months,
        Math.min(y * 12, months),
      );
    }
    const equity = propertyValue - loanBalance;
    yearly.push({
      year: y,
      rent: round2(rentYear),
      cashflow: round2(cf),
      cumulativeCashflow: round2(cumulative),
      propertyValue: round2(propertyValue),
      loanBalance: round2(loanBalance),
      equity: round2(equity),
      totalValueIfSold: round2(equity + cumulative),
    });
  }

  const totalInterestPaid = yearly.reduce((sum, y, idx) => {
    // This is a bit simplified for interest calculation from CF, let's do it properly
    // Interest = (Installment - PrincipalRepayment)
    const prevBalance = idx === 0 ? loanAmount : yearly[idx - 1].loanBalance;
    const principalRepaid = prevBalance - y.loanBalance;

    // We need the total pmt for that year
    let pmtYear = 0;
    const yearNum = idx + 1;
    if (s.mortgageType === "decreasing") {
      for (let m = (yearNum - 1) * 12 + 1; m <= yearNum * 12; m++) {
        if (m > months) break;
        const interest = Math.max(0, loanAmount - (loanAmount / months) * (m - 1)) * (s.mortgageRatePct / 100 / 12);
        pmtYear += loanAmount / months + interest;
      }
    } else {
      pmtYear = monthlyPmt * 12;
    }
    return sum + (pmtYear - principalRepaid);
  }, 0);

  const totalInsurancePaid = (s.mortgageInsuranceMonthly || 0) * 12 * s.holdingYears;
  const totalMortgageCost = totalInterestPaid + bankCommission + totalInsurancePaid;

  // Break-even (cashflow only, no appreciation) - months until cumulative monthly cf > 0 and recoups upfront
  let beMonths = Infinity;
  if (monthlyCashflow > 0) {
    beMonths = totalUpfront / monthlyCashflow;
  }

  const finalEquity = yearly.length ? yearly[yearly.length - 1].equity : downPayment;
  const totalCashflow = cumulative;
  const totalReturn = totalCashflow + (finalEquity - totalUpfront);

  // Invested capital for ROI should include all monthly top-ups if cashflow was negative
  const totalInjections = yearly.reduce((sum, y) => sum + (y.cashflow < 0 ? Math.abs(y.cashflow) : 0), 0);
  const investedCapital = totalUpfront + totalInjections;

  const totalReturnPct = investedCapital > 0 ? (totalReturn / investedCapital) * 100 : 0;

  // Approximate annualized IRR: ((endValue / start) ^ (1/years) − 1)
  // Here start is totalUpfront, but effectively we are adding money over time.
  // For simplicity, we use the same investedCapital base.
  const irrAnnualPct =
    investedCapital > 0 && s.holdingYears > 0
      ? (Math.pow(Math.max(0.0001, (investedCapital + totalReturn) / investedCapital), 1 / s.holdingYears) - 1) * 100
      : 0;

  return {
    downPayment: round2(downPayment),
    closingCosts: round2(closingCosts),
    totalUpfront: round2(totalUpfront),
    loanAmount: round2(loanAmount),
    monthlyPmt: round2(monthlyPmt),
    totalMortgageCost: round2(totalMortgageCost),
    totalInterestPaid: round2(totalInterestPaid),
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
    totalReturn: round2(totalReturn),
    totalReturnPct: round2(totalReturnPct),
    irrAnnualPct: round2(irrAnnualPct),
  };
}

/**
 * Minimum monthly rent (gross, from tenant) at which monthly cash-flow = 0.
 * Solves: rent*(1−tax%) = mortgage + insurance + monthlyCosts
 */
export function minBreakEvenRent(s: RealEstateScenario, r: RealEstateResult): number {
  const totalFixed = r.monthlyPmt + (s.mortgageInsuranceMonthly || 0) + s.monthlyCosts;
  const factor = (1 - s.taxRatePct / 100);
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

/** Cashflow & payment impact for interest-rate deltas of −3 … +3 pp */
export interface WiborScenario {
  rateDelta: number;   // pp relative to current rate
  ratePct: number;     // absolute rate
  monthlyPmt: number;
  monthlyCashflow: number;
  pmtDelta: number;    // vs base
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
