/**
 * Loan amortization (equal installments / "raty równe") and rental P&L helpers.
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
    principal * Math.pow(1 + r, monthsPaid) -
    pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  return Math.max(0, fv);
}

export function loanTotalInterest(
  principal: number,
  annualRatePct: number,
  months: number,
): number {
  return monthlyPayment(principal, annualRatePct, months) * months - principal;
}

export interface RentalInput {
  monthlyRent: number;
  monthlyCosts: number;       // utilities not paid by tenant, management fee, czynsz administracyjny
  monthlyMortgage: number;    // can be 0
  vacancyRatePct: number;     // 0–100
  taxRatePct: number;         // ryczałt 8.5% / 12.5% above 100k
}

export function rentalCashflow(r: RentalInput) {
  const grossRent = r.monthlyRent;
  const effectiveRent = grossRent * (1 - r.vacancyRatePct / 100);
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
