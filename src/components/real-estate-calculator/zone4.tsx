import { useState, useMemo, useEffect, useCallback } from "react";
import { useRealEstate } from "./context";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  Shield,
  Percent,
  RefreshCw,
  Edit3,
  X,
  Loader2,
  Trophy,
} from "lucide-react";
import {
  projectBond,
  getBondAssumptionLabel,
  NBP_REFERENCE_RATE_PCT,
  CURRENT_CPI_ESTIMATE_PCT,
  BELKA_TAX_PCT,
  OBLIGACJE_LAST_UPDATED,
  type BondProjection,
  getCurrentBondCatalog,
  isBondDataOutdated,
  getLastUpdatedText,
  type BondDataOverrides,
  loadBondDataFromSupabase,
} from "@/lib/obligacje";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BOND_COLORS: Record<string, string> = {
  OTS: "oklch(0.62 0.13 175)",
  ROR: "oklch(0.55 0.14 210)",
  DOR: "oklch(0.50 0.14 245)",
  TOS: "oklch(0.74 0.13 75)",
  COI: "oklch(0.62 0.14 148)",
  EDO: "oklch(0.56 0.19 25)",
};

const CATEGORY_LABELS: Record<string, string> = {
  fixed: "Stałe",
  nbp_indexed: "Zmienna (NBP)",
  cpi_indexed: "Indeksowana CPI",
};

const CATEGORY_BADGE: Record<string, string> = {
  fixed: "bg-accent/10 text-accent border-accent/20",
  nbp_indexed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cpi_indexed: "bg-success/10 text-success border-success/20",
};

function BondBadge({ category }: { category: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        CATEGORY_BADGE[category] ?? "bg-muted text-muted-foreground",
      )}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function VerdictBadge({ proj, realIrr }: { proj: BondProjection; realIrr: number }) {
  const diff = proj.irrAnnualNetPct - realIrr;
  if (diff > 1)
    return (
      <span className="text-[10px] font-bold text-success bg-success/10 rounded-full px-2 py-0.5 border border-success/20">
        +{diff.toFixed(1)}% lepiej
      </span>
    );
  if (diff < -1)
    return (
      <span className="text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-2 py-0.5 border border-destructive/20">
        {diff.toFixed(1)}% gorzej
      </span>
    );
  return (
    <span className="text-[10px] font-bold text-warning-foreground bg-warning/10 rounded-full px-2 py-0.5 border border-warning/20">
      Zbliżone
    </span>
  );
}

function VerdictCard({
  reIrr,
  reTotalReturn,
  reUpfront,
  bestBond,
  holdingYears,
}: {
  reIrr: number;
  reTotalReturn: number;
  reUpfront: number;
  bestBond: BondProjection;
  holdingYears: number;
}) {
  if (!bestBond) return null;

  // Real estate total profit is r.totalReturnNominal (this is already normalized inside real estate context)
  // Bond total profit calculation:
  const bondTotalReturn = bestBond.finalValueNet - reUpfront;

  const diffNominal = reTotalReturn - bondTotalReturn;
  const diffIrr = reIrr - bestBond.irrAnnualNetPct;

  const isReBetter = diffNominal > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4 mb-6",
        isReBetter ? "bg-accent/5 border-accent/20" : "bg-warning/5 border-warning/20",
      )}
    >
      {/* Decorative background element */}
      <div className="absolute -right-12 -top-12 opacity-10 pointer-events-none">
        <Trophy className={cn("w-48 h-48", isReBetter ? "text-accent" : "text-warning")} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
              isReBetter
                ? "bg-accent text-accent-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            Werdykt {holdingYears} lat
          </span>
        </div>

        <h3 className="font-display text-2xl mb-1">
          {isReBetter ? "Nieruchomość wygrywa" : "Obligacje wygrywają"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
          Zainwestowanie <strong>{formatPLN(reUpfront)}</strong> (wkład własny + koszty startowe)
          {isReBetter
            ? " w wynajem przynosi wyższy zwrot niż najkorzystniejsze obligacje skarbowe."
            : " w bezpieczne obligacje skarbowe wygrywa z wynajmem nieruchomości."}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-current/10">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Zysk z wynajmu
            </p>
            <p className="font-mono font-bold text-lg">{formatPLN(reTotalReturn)}</p>
            <p className="text-[10px] text-muted-foreground">{reIrr.toFixed(1)}% IRR</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Zysk z obligacji ({bestBond.bond.symbol})
            </p>
            <p className="font-mono font-bold text-lg">{formatPLN(bondTotalReturn)}</p>
            <p className="text-[10px] text-muted-foreground">
              {bestBond.irrAnnualNetPct.toFixed(1)}% CAGR
            </p>
          </div>
          <div className="col-span-2 sm:col-span-2 bg-background/50 rounded-xl p-3 border border-current/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Różnica nominalna
            </p>
            <p
              className={cn(
                "font-mono font-bold text-xl",
                isReBetter ? "text-accent" : "text-warning",
              )}
            >
              {diffNominal > 0 ? "+" : ""}
              {formatPLN(diffNominal)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Przewaga IRR: {diffIrr > 0 ? "+" : ""}
              {diffIrr.toFixed(1)} p.p.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideDialog({
  open,
  onOpenChange,
  catalog,
  manualOverrides,
  onSaveManualOverride,
  onSaveGlobalOverride,
  onClearAll,
}: any) {
  const hasManualOverrides = Object.keys(manualOverrides).length > 0;
  const [editingBond, setEditingBond] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ręczna konfiguracja obligacji</DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-2">
            Zaktualizuj parametry w przypadku, gdy serwer dostarczył przestarzałe dane z MF.
          </p>
        </DialogHeader>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Parametry makroekonomiczne
            </p>
            {hasManualOverrides && (
              <button
                onClick={onClearAll}
                className="text-[10px] text-destructive hover:text-destructive/80 flex items-center gap-1 bg-destructive/10 px-2 py-1 rounded border border-destructive/20"
              >
                <X className="w-3 h-3" />
                Wyczyść wszystko
              </button>
            )}
          </div>

          {/* Global overrides */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground">
                Stopa referencyjna NBP
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  value={manualOverrides.nbpReferenceRate ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    onSaveGlobalOverride("nbpReferenceRate", value);
                  }}
                  placeholder={`${NBP_REFERENCE_RATE_PCT}%`}
                  className="h-9 text-sm"
                />
                {manualOverrides.nbpReferenceRate !== undefined && (
                  <button
                    onClick={() => onSaveGlobalOverride("nbpReferenceRate", undefined)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground">
                Prognozowana inflacja CPI
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  value={manualOverrides.cpiEstimate ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    onSaveGlobalOverride("cpiEstimate", value);
                  }}
                  placeholder={`${CURRENT_CPI_ESTIMATE_PCT}%`}
                  className="h-9 text-sm"
                />
                {manualOverrides.cpiEstimate !== undefined && (
                  <button
                    onClick={() => onSaveGlobalOverride("cpiEstimate", undefined)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Individual bonds */}
          <div className="space-y-3">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Nadpisanie stawek ({catalog.length})
            </Label>
            <div className="grid gap-3">
              {catalog.map((bond: any) => {
                const hasOverride = manualOverrides.bonds && manualOverrides.bonds[bond.symbol];
                const currentOverrides = manualOverrides.bonds?.[bond.symbol] || {};
                const isEditing = editingBond === bond.symbol;

                return (
                  <div
                    key={bond.symbol}
                    className={cn(
                      "p-3 rounded-2xl border text-left flex flex-col transition-all duration-200",
                      hasOverride
                        ? "bg-accent/5 border-accent/30 shadow-sm"
                        : "bg-card border-border/50",
                      isEditing ? "ring-2 ring-accent" : "",
                    )}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setEditingBond(isEditing ? null : bond.symbol)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: BOND_COLORS[bond.symbol] ?? "var(--accent)" }}
                        />
                        <span className="font-display font-bold text-base">{bond.symbol}</span>
                        {hasOverride && (
                          <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ml-1">
                            Nadpisane
                          </span>
                        )}
                      </div>
                      <button className="text-[11px] text-accent hover:text-accent/80 flex items-center gap-1 font-medium">
                        <Edit3 className="w-3.5 h-3.5" />
                        {isEditing ? "Zwiń" : "Edytuj"}
                      </button>
                    </div>

                    {!isEditing && hasOverride && (
                      <div className="text-[10px] text-accent mt-3 p-2.5 bg-accent/10 rounded-xl border border-accent/20">
                        {bond.category === "fixed" && currentOverrides.annualRatePct && (
                          <div>
                            Oprocentowanie: <strong>{currentOverrides.annualRatePct}%</strong>{" "}
                            (domyślnie: {bond.annualRatePct}%)
                          </div>
                        )}
                        {bond.category === "nbp_indexed" && (
                          <div>
                            Miesiąc 1:{" "}
                            <strong>{currentOverrides.nbpMonth1Pct ?? bond.nbpMonth1Pct}%</strong>
                            {currentOverrides.nbpMarginPct !== undefined && (
                              <>
                                {" "}
                                · Marża NBP:{" "}
                                <strong>
                                  {currentOverrides.nbpMarginPct > 0 ? "+" : ""}
                                  {currentOverrides.nbpMarginPct}%
                                </strong>
                              </>
                            )}
                          </div>
                        )}
                        {bond.category === "cpi_indexed" && (
                          <div>
                            Rok 1:{" "}
                            <strong>{currentOverrides.cpiYear1Pct ?? bond.cpiYear1Pct}%</strong>
                            {currentOverrides.cpiMarginPct !== undefined && (
                              <>
                                {" "}
                                · Marża CPI:{" "}
                                <strong>
                                  {currentOverrides.cpiMarginPct > 0 ? "+" : ""}
                                  {currentOverrides.cpiMarginPct}%
                                </strong>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="space-y-3 pt-4 border-t border-border/50 mt-3">
                        {bond.category === "fixed" && (
                          <div className="flex items-center gap-3">
                            <Label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">
                              Stałe %
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="20"
                              value={currentOverrides.annualRatePct ?? ""}
                              onChange={(e) =>
                                onSaveManualOverride(
                                  bond.symbol,
                                  "annualRatePct",
                                  e.target.value ? parseFloat(e.target.value) : undefined,
                                )
                              }
                              placeholder={`${bond.annualRatePct ?? ""}%`}
                              className="h-8 text-xs flex-1"
                            />
                            <span className="text-[10px] text-muted-foreground w-24">
                              Domyślnie: {bond.annualRatePct ?? "—"}%
                            </span>
                          </div>
                        )}

                        {bond.category === "nbp_indexed" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">
                                Miesiąc 1 %
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="20"
                                value={currentOverrides.nbpMonth1Pct ?? ""}
                                onChange={(e) =>
                                  onSaveManualOverride(
                                    bond.symbol,
                                    "nbpMonth1Pct",
                                    e.target.value ? parseFloat(e.target.value) : undefined,
                                  )
                                }
                                placeholder={`${bond.nbpMonth1Pct ?? ""}%`}
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-24">
                                Domyślnie: {bond.nbpMonth1Pct ?? "—"}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">
                                Marża NBP
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="-5"
                                max="10"
                                value={currentOverrides.nbpMarginPct ?? ""}
                                onChange={(e) =>
                                  onSaveManualOverride(
                                    bond.symbol,
                                    "nbpMarginPct",
                                    e.target.value ? parseFloat(e.target.value) : undefined,
                                  )
                                }
                                placeholder={`${bond.nbpMarginPct ?? 0}%`}
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-24">
                                Domyślnie: {bond.nbpMarginPct ?? 0}%
                              </span>
                            </div>
                          </div>
                        )}

                        {bond.category === "cpi_indexed" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">
                                Rok 1 %
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="20"
                                value={currentOverrides.cpiYear1Pct ?? ""}
                                onChange={(e) =>
                                  onSaveManualOverride(
                                    bond.symbol,
                                    "cpiYear1Pct",
                                    e.target.value ? parseFloat(e.target.value) : undefined,
                                  )
                                }
                                placeholder={`${bond.cpiYear1Pct ?? ""}%`}
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-24">
                                Domyślnie: {bond.cpiYear1Pct ?? "—"}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Label className="text-[11px] text-muted-foreground w-20 flex-shrink-0">
                                Marża CPI
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="-5"
                                max="10"
                                value={currentOverrides.cpiMarginPct ?? ""}
                                onChange={(e) =>
                                  onSaveManualOverride(
                                    bond.symbol,
                                    "cpiMarginPct",
                                    e.target.value ? parseFloat(e.target.value) : undefined,
                                  )
                                }
                                placeholder={`${bond.cpiMarginPct ?? 0}%`}
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-24">
                                Domyślnie: {bond.cpiMarginPct ?? 0}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ObligacjeTab() {
  const { r, s } = useRealEstate();

  // Use totalUpfront as the "alternative investment" amount
  const investmentAmount = r.totalUpfront;
  const holdingYears = s.holdingYears;
  const realEstateIrrNet = r.irrAnnualPct; // already roughly net of tax in RE context

  // Supabase auto-load state
  const [dataStatus, setDataStatus] = useState<"loading" | "fresh" | "stale" | "error">("loading");
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);

  // User-adjustable assumptions
  const [assumedNbp, setAssumedNbp] = useState(NBP_REFERENCE_RATE_PCT);
  const [assumedCpi, setAssumedCpi] = useState(CURRENT_CPI_ESTIMATE_PCT);
  const [selectedBonds, setSelectedBonds] = useState<string[]>(["TOS", "COI", "EDO"]);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [expandedBond, setExpandedBond] = useState<string | null>(null);

  // Bond data management

  const [bondOverrides, setBondOverrides] = useState<BondDataOverrides | undefined>(undefined);

  // Manual override state
  const [manualOverrides, setManualOverrides] = useState<
    Partial<{
      nbpReferenceRate: number;
      cpiEstimate: number;
      bonds: Record<
        string,
        {
          annualRatePct?: number;
          nbpMonth1Pct?: number;
          nbpMarginPct?: number;
          cpiYear1Pct?: number;
          cpiMarginPct?: number;
          earlyRedemptionPenaltyPct?: number;
          earlyRedemptionFixedFee?: number;
          minHoldMonths?: number;
        }
      >;
    }>
  >({});
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [editingBond, setEditingBond] = useState<string | null>(null);

  // Load manual overrides from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("bondManualOverrides");
    if (saved) {
      try {
        setManualOverrides(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to parse saved manual overrides:", error);
      }
    }
  }, []);

  // Save manual overrides to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(manualOverrides).length > 0) {
      localStorage.setItem("bondManualOverrides", JSON.stringify(manualOverrides));
    } else {
      localStorage.removeItem("bondManualOverrides");
    }
  }, [manualOverrides]);

  // Auto-load bond data from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setDataStatus("loading");
      try {
        const data = await loadBondDataFromSupabase();
        if (cancelled) return;
        if (data && data.bonds && data.bonds.length > 0) {
          setBondOverrides(data);
          setLastUpdatedDate(data.lastUpdated);
          setDataStatus(isBondDataOutdated(data.lastUpdated) ? "stale" : "fresh");
          // Sync assumed NBP/CPI from DB values
          if (data.nbpReferenceRate) setAssumedNbp(data.nbpReferenceRate);
          if (data.cpiEstimate) setAssumedCpi(data.cpiEstimate);
        } else {
          if (!cancelled) setDataStatus("error");
          setLastUpdatedDate(OBLIGACJE_LAST_UPDATED);
        }
      } catch {
        if (!cancelled) {
          setDataStatus("error");
          setLastUpdatedDate(OBLIGACJE_LAST_UPDATED);
        }
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Manual refresh via API route
  const handleFetchLatestData = useCallback(async () => {
    setIsFetchingData(true);
    try {
      const res = await fetch("/api/obligacje/latest?forceRefresh=true");
      if (res.ok) {
        const data = await res.json();
        const overrides: BondDataOverrides = {
          lastUpdated: data.lastUpdated,
          nbpReferenceRate: data.nbpReferenceRate ?? NBP_REFERENCE_RATE_PCT,
          cpiEstimate: data.cpiEstimate ?? CURRENT_CPI_ESTIMATE_PCT,
          bonds: data.bonds ?? [],
          source: data.source,
          isUserOverride: false,
        };
        setBondOverrides(overrides);
        setLastUpdatedDate(data.lastUpdated);
        setDataStatus(isBondDataOutdated(data.lastUpdated) ? "stale" : "fresh");
        if (data.nbpReferenceRate) setAssumedNbp(data.nbpReferenceRate);
        if (data.cpiEstimate) setAssumedCpi(data.cpiEstimate);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingData(false);
    }
  }, []);

  // Get current bond catalog with overrides applied
  const currentBondCatalog = useMemo(() => {
    let catalog = getCurrentBondCatalog(bondOverrides || undefined);

    // Apply manual overrides
    if (Object.keys(manualOverrides).length > 0) {
      catalog = catalog.map((bond) => {
        const manualBondOverride = manualOverrides.bonds?.[bond.symbol];
        if (manualBondOverride) {
          return {
            ...bond,
            annualRatePct: manualBondOverride.annualRatePct ?? bond.annualRatePct,
            nbpMonth1Pct: manualBondOverride.nbpMonth1Pct ?? bond.nbpMonth1Pct,
            nbpMarginPct: manualBondOverride.nbpMarginPct ?? bond.nbpMarginPct,
            cpiYear1Pct: manualBondOverride.cpiYear1Pct ?? bond.cpiYear1Pct,
            cpiMarginPct: manualBondOverride.cpiMarginPct ?? bond.cpiMarginPct,
            earlyRedemptionPenaltyPct:
              manualBondOverride.earlyRedemptionPenaltyPct ?? bond.earlyRedemptionPenaltyPct,
            earlyRedemptionFixedFee:
              manualBondOverride.earlyRedemptionFixedFee ?? bond.earlyRedemptionFixedFee,
            minHoldMonths: manualBondOverride.minHoldMonths ?? bond.minHoldMonths,
          };
        }
        return bond;
      });
    }

    return catalog;
  }, [bondOverrides, manualOverrides]);

  // Use manual overrides for NBP and CPI if available
  const effectiveNbp = manualOverrides.nbpReferenceRate ?? assumedNbp;
  const effectiveCpi = manualOverrides.cpiEstimate ?? assumedCpi;

  const projections = useMemo(() => {
    return currentBondCatalog
      .filter((b) => selectedBonds.includes(b.symbol))
      .map((bond) => projectBond(bond, investmentAmount, holdingYears, effectiveCpi, effectiveNbp));
  }, [
    currentBondCatalog,
    selectedBonds,
    investmentAmount,
    holdingYears,
    effectiveCpi,
    effectiveNbp,
  ]);

  // All projections for chart (to compare lines)
  const allProjections = useMemo(
    () =>
      currentBondCatalog.map((bond) =>
        projectBond(bond, investmentAmount, holdingYears, effectiveCpi, effectiveNbp),
      ),
    [currentBondCatalog, investmentAmount, holdingYears, effectiveCpi, effectiveNbp],
  );

  // Real estate net value projection per year
  const realEstateByYear = useMemo(() => {
    return s.holdingYears > 0
      ? r.yearly.map((y) => ({
          year: y.year,
          value: y.equity + y.cumulativeCashflow,
        }))
      : [];
  }, [r.yearly, s.holdingYears]);

  // Build unified chart data
  const chartData = useMemo(() => {
    return Array.from({ length: holdingYears }, (_, i) => {
      const year = i + 1;
      const point: Record<string, any> = { year: `${year}r`, maturedBonds: new Set<string>() };

      // Real estate equity + cumulative cashflow vs initial investment
      const rePoint = realEstateByYear.find((p) => p.year === year);
      point["Nieruchomość"] = rePoint ? round2(rePoint.value) : 0;

      // Each bond final value at this year, track which have matured
      for (const proj of allProjections) {
        const yearlyPoint = proj.yearly[Math.min(i, proj.yearly.length - 1)];
        point[proj.bond.symbol] = yearlyPoint ? yearlyPoint.nominalValueNet : investmentAmount;
        const tenorYears = proj.bond.tenorMonths / 12;
        if (year > tenorYears) {
          point.maturedBonds.add(proj.bond.symbol);
        }
      }

      return point;
    });
  }, [allProjections, realEstateByYear, holdingYears, investmentAmount]);

  const bestBond =
    projections.length > 0
      ? projections.reduce((best, p) => (p.irrAnnualNetPct > best.irrAnnualNetPct ? p : best))
      : allProjections[0];

  // Sort projections by net IRR descending
  const sortedProjections = [...projections].sort((a, b) => b.irrAnnualNetPct - a.irrAnnualNetPct);

  const toggleBond = (symbol: string) => {
    setSelectedBonds((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  };

  // Bond status derived from new state
  const isDataOutdated = lastUpdatedDate ? isBondDataOutdated(lastUpdatedDate) : true;
  const currentLastUpdated = lastUpdatedDate ?? OBLIGACJE_LAST_UPDATED;
  const isUsingOverrides = bondOverrides !== undefined;

  // Manual override functions
  const handleSaveManualOverride = (symbol: string, field: string, value: number | undefined) => {
    setManualOverrides((prev) => {
      const newOverrides = { ...prev };
      if (!newOverrides.bonds) newOverrides.bonds = {};

      if (value === undefined) {
        // Remove the override
        if (newOverrides.bonds[symbol]) {
          delete newOverrides.bonds[symbol][field as keyof (typeof newOverrides.bonds)[string]];
          if (Object.keys(newOverrides.bonds[symbol]).length === 0) {
            delete newOverrides.bonds[symbol];
          }
        }
      } else {
        // Set the override and expand the editing section
        if (!newOverrides.bonds[symbol]) newOverrides.bonds[symbol] = {};
        (newOverrides.bonds[symbol] as any)[field] = value;
        setEditingBond(symbol); // Auto-expand when setting override
      }

      return newOverrides;
    });
  };

  const handleSaveGlobalOverride = (
    field: "nbpReferenceRate" | "cpiEstimate",
    value: number | undefined,
  ) => {
    setManualOverrides((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClearAllManualOverrides = () => {
    setManualOverrides({});
  };

  const hasManualOverrides = Object.keys(manualOverrides).length > 0;

  if (investmentAmount <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">
          Uzupełnij parametry inwestycji, aby zobaczyć porównanie z obligacjami.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header context card */}
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-xl mb-1">Obligacje jako alternatywa</h3>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Zakładamy, że zamiast kupić nieruchomość, inwestujesz ten sam kapitał zaangażowany w
              nieruchomość (wkład własny + koszty transakcyjne) –
              <strong className="text-foreground">{formatPLN(investmentAmount)}</strong> w Obligacje
              Skarbu Państwa przez <strong className="text-foreground">{holdingYears} lat</strong>.{" "}
              {hasManualOverrides ? (
                <>Dane obligacji zostały ręcznie nadpisane przez użytkownika.</>
              ) : (
                <>{getLastUpdatedText(currentLastUpdated, isUsingOverrides)}.</>
              )}
              {isDataOutdated && !hasManualOverrides && (
                <span className="text-warning-foreground font-medium">
                  {" "}
                  Dane mogą być nieaktualne.
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-accent/5 rounded-2xl px-4 py-3 border border-accent/10 min-w-max">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                IRR Nieruchomości
              </p>
              <p className="font-display text-2xl font-bold text-accent">
                {realEstateIrrNet.toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground">z dźwignią kredytową</p>
            </div>
          </div>
        </div>

        {/* Data Status Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 mt-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[10px] text-muted-foreground border border-border/50">
            {isFetchingData ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {dataStatus === "loading" ? "Ładowanie..." : getLastUpdatedText(currentLastUpdated)}
          </div>
          {dataStatus === "stale" && !hasManualOverrides && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning-foreground text-[10px] border border-warning/20">
              <AlertTriangle className="w-3 h-3" />
              Dane mogą być nieaktualne
            </div>
          )}
          {hasManualOverrides && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[10px] border border-accent/20">
              <Edit3 className="w-3 h-3" />
              Własne parametry aktywne
            </div>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchLatestData}
            disabled={isFetchingData}
            className="h-7 text-[10px] px-2.5 rounded-full"
          >
            Odśwież z MF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOverrideDialog(true)}
            className="h-7 text-[10px] px-2.5 rounded-full"
          >
            Ręczna edycja
          </Button>
        </div>
      </div>

      <VerdictCard
        reIrr={realEstateIrrNet}
        reTotalReturn={r.totalReturn}
        reUpfront={investmentAmount}
        bestBond={sortedProjections[0]}
        holdingYears={holdingYears}
      />

      <OverrideDialog
        open={showOverrideDialog}
        onOpenChange={setShowOverrideDialog}
        catalog={currentBondCatalog}
        manualOverrides={manualOverrides}
        onSaveManualOverride={handleSaveManualOverride}
        onSaveGlobalOverride={handleSaveGlobalOverride}
        onClearAll={handleClearAllManualOverrides}
      />
      {/* Bond selector */}
      <div className="bg-card rounded-3xl p-5 border border-border shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Wybierz obligacje do analizy
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {currentBondCatalog.map((bond) => {
            const isSelected = selectedBonds.includes(bond.symbol);
            const color = BOND_COLORS[bond.symbol] ?? "var(--accent)";
            const tenorYears = bond.tenorMonths / 12;
            const isEarly = holdingYears < tenorYears;
            return (
              <button
                key={bond.symbol}
                onClick={() => toggleBond(bond.symbol)}
                className={cn(
                  "text-left rounded-2xl p-3.5 border transition-all duration-200 relative",
                  isSelected
                    ? "bg-card border-current shadow-sm"
                    : "bg-muted/20 border-transparent opacity-60 hover:opacity-80",
                )}
                style={isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}22` } : {}}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span
                    className="font-display font-bold text-lg leading-none"
                    style={{ color: isSelected ? color : undefined }}
                  >
                    {bond.symbol}
                  </span>
                  {isEarly && isSelected && (
                    <AlertTriangle className="w-3 h-3 text-warning-foreground shrink-0 mt-0.5" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight mb-2">
                  {tenorYears === 0.25
                    ? "3 m-ce"
                    : tenorYears === 1
                      ? "1 rok"
                      : `${tenorYears} lat`}
                </p>
                <BondBadge category={bond.category} />
                {isEarly && isSelected && (
                  <p className="text-[9px] text-warning-foreground mt-1.5 font-medium">
                    Wcześniejszy wykup
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart: value over time */}
      {projections.length > 0 && (
        <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-sm">
          <h3 className="font-display text-lg mb-1">Wzrost wartości rok do roku</h3>
          <p className="text-xs text-muted-foreground mb-6">
            Wartość netto (po podatku Belki {BELKA_TAX_PCT}%) w zł. Nieruchomość = equity +
            skumulowany cashflow. Słabsza przezroczystość = lata po zapadalności obligacji.
          </p>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 85)" vertical={true} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => {
                    if (name === "maturedBonds") return null;
                    return [formatPLN(v), name];
                  }}
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-elevated)",
                    backgroundColor: "var(--card)",
                  }}
                  labelFormatter={(l) => `Po ${l}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
                  iconType="square"
                  iconSize={8}
                />
                <ReferenceLine
                  y={investmentAmount}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: "Wkład własny",
                    fontSize: 9,
                    fill: "var(--muted-foreground)",
                    position: "insideTopLeft",
                  }}
                />
                {/* Real estate bar */}
                <Bar dataKey="Nieruchomość" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-re-${index}`} fill="var(--accent)" opacity={0.9} />
                  ))}
                </Bar>
                {/* Selected bond bars */}
                {projections.map((proj) => {
                  const color = BOND_COLORS[proj.bond.symbol] ?? "var(--muted-foreground)";
                  const tenorYears = proj.bond.tenorMonths / 12;
                  return (
                    <Bar
                      key={proj.bond.symbol}
                      dataKey={proj.bond.symbol}
                      fill={color}
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((_, index) => {
                        const year = index + 1;
                        const isMatured = year > tenorYears;
                        return (
                          <Cell
                            key={`cell-${proj.bond.symbol}-${index}`}
                            fill={color}
                            opacity={isMatured ? 0.35 : 0.85}
                          />
                        );
                      })}
                    </Bar>
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-muted-foreground text-center mt-2 italic">
            Słabsza przezroczystość = okres po zapadalności obligacji (bez rolowania, środki w
            gotówce).
          </p>
        </div>
      )}

      {/* Bond cards */}
      {sortedProjections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Szczegóły per obligacja
            </p>
            <p className="text-[10px] text-muted-foreground">Posortowane wg. CAGR netto malejąco</p>
          </div>

          {sortedProjections.map((proj) => {
            const color = BOND_COLORS[proj.bond.symbol] ?? "var(--accent)";
            const tenorYears = proj.bond.tenorMonths / 12;
            const isExpanded = expandedBond === proj.bond.symbol;
            const diff = proj.irrAnnualNetPct - realEstateIrrNet;
            const isBetter = diff > 0;
            const bondEndsBeforeAnalysis = tenorYears < holdingYears;
            const propertyAtBondMaturity = Number.isInteger(tenorYears)
              ? realEstateByYear.find((p) => p.year === tenorYears)
              : undefined;

            return (
              <Collapsible
                key={proj.bond.symbol}
                open={isExpanded}
                onOpenChange={(v) => setExpandedBond(v ? proj.bond.symbol : null)}
              >
                <div
                  className="bg-card rounded-3xl border overflow-hidden shadow-sm transition-all"
                  style={{ borderColor: isExpanded ? color : undefined }}
                >
                  {/* Card header */}
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left p-5 sm:p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Symbol badge */}
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg shrink-0 text-white"
                          style={{ backgroundColor: color }}
                        >
                          {proj.bond.symbol}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-sm">{proj.bond.name}</p>
                            <BondBadge category={proj.bond.category} />
                            {proj.isEarlyRedemption && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-warning/10 text-warning-foreground border border-warning/20 rounded-full px-2 py-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Wcześniejszy wykup
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {getBondAssumptionLabel(proj.bond)} ·{" "}
                            {tenorYears < 1 ? `${proj.bond.tenorMonths} m-ce` : `${tenorYears} lat`}{" "}
                            · Belka {BELKA_TAX_PCT}%
                          </p>
                        </div>

                        {/* Right metrics */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <VerdictBadge proj={proj} realIrr={realEstateIrrNet} />
                          </div>
                          <p
                            className={cn(
                              "font-display text-2xl font-bold leading-none",
                              isBetter ? "text-success" : "text-destructive",
                            )}
                          >
                            {proj.irrAnnualNetPct.toFixed(1)}%
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                            CAGR netto
                          </p>
                        </div>
                      </div>

                      {/* Warning message */}
                      {proj.warningMessage && (
                        <div className="mt-3 flex items-start gap-2 bg-warning/5 border border-warning/15 rounded-xl p-2.5 text-[10px] text-warning-foreground">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <p>{proj.warningMessage}</p>
                        </div>
                      )}

                      {/* Quick stats row */}
                      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/50">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Wartość netto
                          </p>
                          <p className="font-mono text-xs font-bold">
                            {formatPLN(proj.finalValueNet)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Zysk netto
                          </p>
                          <p className="font-mono text-xs font-bold text-success">
                            +{formatPLN(proj.totalNetInterest)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Kara wykupu
                          </p>
                          <p
                            className={cn(
                              "font-mono text-xs font-bold",
                              proj.penaltyTotal > 0 ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {proj.penaltyTotal > 0 ? `-${formatPLN(proj.penaltyTotal)}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                            Vs. RE
                          </p>
                          <p
                            className={cn(
                              "font-mono text-xs font-bold",
                              isBetter ? "text-success" : "text-destructive",
                            )}
                          >
                            {isBetter ? "+" : ""}
                            {diff.toFixed(1)}% p.a.
                          </p>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  {/* Expanded: year-by-year table + description */}
                  <CollapsibleContent>
                    <div className="px-5 sm:px-6 pb-6 space-y-5 border-t border-border/50">
                      <div className="pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Opis obligacji
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {proj.bond.description}
                        </p>
                        {proj.bond.notes && (
                          <p className="text-[11px] text-accent mt-1 font-medium">
                            ℹ {proj.bond.notes}
                          </p>
                        )}
                        {bondEndsBeforeAnalysis && (
                          <div className="mt-3 rounded-2xl bg-muted/20 border border-border p-3 text-[11px] text-muted-foreground space-y-2">
                            <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
                              Obowiązuje zakończenie obligacji
                            </p>
                            <p>
                              Ta obligacja kończy się po {tenorYears} latach. W dalszych latach do{" "}
                              {holdingYears} lat wartość jest pokazana jako kwota po wykupie, bez
                              rolowania.
                            </p>
                            {propertyAtBondMaturity ? (
                              <p>
                                Przy skróconym horyzoncie do {tenorYears} lat nieruchomość miałaby
                                wartość netto {formatPLN(propertyAtBondMaturity.value)}.
                              </p>
                            ) : (
                              <p>
                                Jeśli analizę nieruchomości skrócić do {tenorYears} lat, wartość
                                byłaby odpowiednio niższa niż dłuższy horyzont.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Year by year table */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Wartość rok do roku
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wider">
                                <th className="text-left px-3 py-2 font-medium">Rok</th>
                                <th className="text-right px-3 py-2 font-medium">Oprocentowanie</th>
                                <th className="text-right px-3 py-2 font-medium">Odsetki brutto</th>
                                <th className="text-right px-3 py-2 font-medium">Kara</th>
                                <th className="text-right px-3 py-2 font-medium">Wartość netto</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono divide-y divide-border">
                              {proj.yearly.map((pt) => (
                                <tr
                                  key={pt.year}
                                  className={cn(
                                    "transition-colors",
                                    pt.isEarlyRedemption
                                      ? "bg-warning/5"
                                      : pt.isMaturity
                                        ? "bg-accent/5 underline decoration-accent/50"
                                        : "hover:bg-muted/20",
                                  )}
                                >
                                  <td className="px-3 py-1.5">
                                    <span className="font-sans text-[10px] font-bold text-muted-foreground">
                                      {pt.year}
                                    </span>
                                    {pt.isEarlyRedemption && (
                                      <AlertTriangle className="w-2.5 h-2.5 text-warning-foreground inline ml-1" />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right">
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5"
                                      style={{
                                        backgroundColor: `${color}18`,
                                        color,
                                      }}
                                    >
                                      <Percent className="w-2 h-2" />
                                      {pt.annualRatePct.toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-success text-[11px]">
                                    +{formatPLN2(pt.annualInterest)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-[11px]">
                                    {pt.penaltyApplied > 0 ? (
                                      <span className="text-destructive">
                                        -{formatPLN2(pt.penaltyApplied)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-bold text-[11px]">
                                    {formatPLN(pt.nominalValueNet)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Comparison summary */}
                      <div
                        className={cn(
                          "rounded-2xl p-4 border",
                          isBetter
                            ? "bg-success/5 border-success/20"
                            : "bg-destructive/5 border-destructive/20",
                        )}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">
                          Podsumowanie vs. Nieruchomość
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground text-[10px]">
                              Obligacje CAGR netto
                            </p>
                            <p className="font-bold font-mono" style={{ color }}>
                              {proj.irrAnnualNetPct.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Nieruchomość CAGR</p>
                            <p className="font-bold font-mono text-accent">
                              {realEstateIrrNet.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Różnica zysku</p>
                            <p
                              className={cn(
                                "font-bold font-mono",
                                isBetter ? "text-success" : "text-destructive",
                              )}
                            >
                              {isBetter ? "+" : ""}
                              {formatPLN(
                                proj.totalNetInterest - (r.totalReturn > 0 ? r.totalReturn : 0),
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[10px]">Ryzyko</p>
                            <p className="font-bold text-success text-[11px]">Gwarantowane</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {projections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Shield className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Wybierz co najmniej jedną obligację do analizy.
          </p>
        </div>
      )}

      {/* Key insight box */}
      <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-3">
        <h4 className="font-display text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Kluczowe wnioski
        </h4>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Najlepsza obligacja
            </p>
            <p
              className="font-display text-lg font-bold"
              style={{ color: BOND_COLORS[bestBond.bond.symbol] }}
            >
              {bestBond.bond.symbol}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {bestBond.irrAnnualNetPct.toFixed(1)}% CAGR netto
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Zalety obligacji
            </p>
            <ul className="space-y-1 text-muted-foreground leading-relaxed">
              <li>✓ Gwarancja Skarbu Państwa</li>
              <li>✓ Brak ryzyka pustostanu</li>
              <li>✓ Pełna płynność (z karą)</li>
            </ul>
          </div>
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Zalety nieruchomości
            </p>
            <ul className="space-y-1 text-muted-foreground leading-relaxed">
              <li>✓ Dźwignia finansowa (kredyt)</li>
              <li>✓ Ochrona przed CPI (real asset)</li>
              <li>✓ Możliwy cashflow co miesiąc</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic border-t border-border/50 pt-3">
          ⚠ Porównanie uproszczone. Nieruchomość uwzględnia dźwignię kredytową, ryzyko płynności i
          zarządzania. Obligacje zakładają reinwestycję odsetek w tym samym instrumencie lub
          rolowanie.
          {hasManualOverrides ? (
            <>Dane obligacji zostały ręcznie nadpisane przez użytkownika.</>
          ) : isUsingOverrides ? (
            <>
              Dane obligacji zostały nadpisane przez użytkownika (
              {getLastUpdatedText(currentLastUpdated, true)}).
            </>
          ) : (
            <>
              Oprocentowanie obligacji na podstawie aktualnej oferty Ministerstwa Finansów (
              {getLastUpdatedText(currentLastUpdated)}).
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
