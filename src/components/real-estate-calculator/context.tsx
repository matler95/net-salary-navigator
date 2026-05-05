import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { calculateAnnualAverageNet } from "@/lib/salary";
import {
  getExpenseMonthlyAverage,
  monthlyPayment,
  calculateRealEstate,
  minBreakEvenRent,
  getInvestmentVerdict,
  wiborSensitivity,
  calcRequiredOverpayment,
  type RealEstateScenario,
  type RealEstateResult,
  type InvestmentVerdict,
  type WiborScenario,
} from "@/lib/finance";
import { useAppState } from "@/lib/store";

export interface BudgetImpact {
  totalNetIncome: number;
  currentDisposable: number;
  newDisposable: number;
  totalDTI: number;
}

export interface RealEstateContextValue {
  s: RealEstateScenario;
  setS: React.Dispatch<React.SetStateAction<RealEstateScenario>>;
  updateS: (patch: Partial<RealEstateScenario>) => void;
  costs: { admin: number; media: number; management: number; insurance: number; reserve: number };
  setCosts: React.Dispatch<
    React.SetStateAction<{
      admin: number;
      media: number;
      management: number;
      insurance: number;
      reserve: number;
    }>
  >;
  r: RealEstateResult;
  minRent: number;
  /** Steady-state monthly cashflow at full occupancy (no vacancy dilution). */
  steadyCashflow: number;
  verdict: InvestmentVerdict;
  wiborData: WiborScenario[];
  budgetImpact: BudgetImpact;
  cashflowPositive: boolean;
  rentMargin: number;
  rentMarginPct: number;
  requiredOverpayment: number;
}

const RealEstateContext = createContext<RealEstateContextValue | null>(null);

export function useRealEstate() {
  const context = useContext(RealEstateContext);
  if (!context) {
    throw new Error("useRealEstate must be used within a RealEstateProvider");
  }
  return context;
}

const REAL_ESTATE_SCENARIO_STORAGE_KEY = "realEstateScenario";

export function RealEstateProvider({ children }: { children: React.ReactNode }) {
  const defaultScenario: RealEstateScenario = {
    purchasePrice: 650000,
    downPaymentPct: 20,
    renovationCost: 50000,
    renovationFinancedPct: 0,
    renovationMonths: 0,
    tenantSearchMonths: 0,
    marketType: "wtórny",
    hasAgency: true,
    mortgageRatePct: 7.2,
    mortgageYears: 30,
    mortgageType: "equal",
    bankCommissionPct: 0,
    mortgageInsuranceMonthly: 150,
    tsoverpaymentEnabled: false,
    overpaymentMonthly: null,
    monthlyRent: 3500,
    monthlyCosts: 300,
    tenantPaysAdmin: true,
    tenantPaysMedia: true,
    taxRatePct: 8.5,
    rentGrowthPct: 3,
    appreciationPct: 4,
    holdingYears: 15,
    sellAtEnd: true,
  };

  const [s, setS] = useState<RealEstateScenario>(() => {
    if (typeof window === "undefined") return defaultScenario;
    try {
      const stored = window.localStorage.getItem(REAL_ESTATE_SCENARIO_STORAGE_KEY);
      if (!stored) return defaultScenario;
      return { ...defaultScenario, ...JSON.parse(stored) };
    } catch {
      return defaultScenario;
    }
  });

  const [costs, setCosts] = useState({
    admin: 500,
    media: 0,
    management: 0,
    insurance: 50,
    reserve: 250,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(REAL_ESTATE_SCENARIO_STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignore write errors
    }
  }, [s]);

  const updateS = (patch: Partial<RealEstateScenario>) => setS((prev) => ({ ...prev, ...patch }));

  const [isInsuranceManual, setIsInsuranceManual] = useState(false);

  // Auto-calculate suggested insurance
  useEffect(() => {
    if (!isInsuranceManual && s.purchasePrice > 0) {
      const principal = s.purchasePrice * (1 - s.downPaymentPct / 100);
      const suggestedInsurance = Math.round(principal * 0.0004);
      setS((prev) => ({ ...prev, mortgageInsuranceMonthly: suggestedInsurance }));
    }
  }, [s.purchasePrice, s.downPaymentPct, isInsuranceManual]);

  // Sync visual costs to monthly costs
  useEffect(() => {
    const monthlyCosts =
      costs.management +
      costs.insurance +
      costs.reserve +
      (s.tenantPaysAdmin ? 0 : costs.admin) +
      (s.tenantPaysMedia ? 0 : costs.media);

    setS((prev) => {
      if (prev.monthlyCosts === monthlyCosts) return prev;
      return { ...prev, monthlyCosts };
    });
  }, [costs, s.tenantPaysAdmin, s.tenantPaysMedia]);

  // Handle manual insurance override
  const originalSetS = setS;
  const wrappedSetS: React.Dispatch<React.SetStateAction<RealEstateScenario>> = (val) => {
    if (typeof val === "function") {
      originalSetS((prev) => {
        const next = val(prev);
        if (next.mortgageInsuranceMonthly !== prev.mortgageInsuranceMonthly)
          setIsInsuranceManual(true);
        return next;
      });
    } else {
      if (val.mortgageInsuranceMonthly !== s.mortgageInsuranceMonthly) setIsInsuranceManual(true);
      originalSetS(val);
    }
  };

  const requiredOverpayment = useMemo(() => calcRequiredOverpayment(s), [s]);
  const r = useMemo(() => calculateRealEstate(s), [s]);

  // Steady-state: a normal fully-rented month (no vacancy dilution)
  const steadyCashflow = useMemo(() => {
    const overpayment = s.tsoverpaymentEnabled ? (s.overpaymentMonthly ?? requiredOverpayment) : 0;
    const tax = s.monthlyRent * (s.taxRatePct / 100);
    return (
      s.monthlyRent -
      s.monthlyCosts -
      r.monthlyPmt -
      (s.mortgageInsuranceMonthly || 0) -
      overpayment -
      tax
    );
  }, [s, r.monthlyPmt, requiredOverpayment]);

  const cashflowPositive = steadyCashflow >= 0;
  const minRent = useMemo(() => minBreakEvenRent(s, r), [s, r]);
  const verdict = getInvestmentVerdict(r);
  const wiborData = useMemo(() => wiborSensitivity(s, r), [s, r]);

  // BUDGET INTEGRATION
  const spouses = useAppState((st) => st.spouses);
  const expenses = useAppState((st) => st.expenses);
  const loans = useAppState((st) => st.loans);
  const globalSettings = useAppState((st) => st.globalSettings);

  const budgetImpact = useMemo(() => {
    const totalNetIncome = spouses.reduce(
      (sum, sp) => sum + calculateAnnualAverageNet(sp.inputs, globalSettings),
      0,
    );
    const totalExpenses = expenses.reduce((sum, e) => sum + getExpenseMonthlyAverage(e), 0);
    const existingLoanPayments = loans.reduce(
      (sum, l) =>
        sum +
        monthlyPayment(l.principal, l.annualRatePct, l.monthsRemaining) +
        (l.mortgageInsuranceMonthly ?? 0),
      0,
    );

    const currentDisposable = totalNetIncome - totalExpenses - existingLoanPayments;
    const newDisposable = currentDisposable + r.monthlyCashflow;
    const totalDTI =
      totalNetIncome > 0 ? ((existingLoanPayments + r.monthlyPmt) / totalNetIncome) * 100 : 0;

    return {
      totalNetIncome,
      currentDisposable,
      newDisposable,
      totalDTI,
    };
  }, [spouses, expenses, loans, globalSettings, r.monthlyCashflow, r.monthlyPmt]);

  const rentMargin = s.monthlyRent - minRent;
  const rentMarginPct = minRent > 0 ? (rentMargin / minRent) * 100 : 0;

  const value: RealEstateContextValue = {
    s,
    setS: wrappedSetS,
    updateS,
    costs,
    setCosts,
    r,
    minRent,
    steadyCashflow,
    verdict,
    wiborData,
    budgetImpact,
    cashflowPositive,
    rentMargin,
    rentMarginPct,
    requiredOverpayment,
  };

  return <RealEstateContext.Provider value={value}>{children}</RealEstateContext.Provider>;
}
