import { useState } from "react";
import { useRealEstate } from "./context";
import { NumField, SliderField } from "./shared";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { Home, Building2, Wallet, TrendingUp, ChevronUp, ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateRealEstate } from "@/lib/finance";
import { Switch } from "@/components/ui/switch";

export function InputPanel() {
  const { s, updateS, costs, setCosts, r, minRent } = useRealEstate();
  const [isExpanded, setIsExpanded] = useState(true);

  // Helper to calculate CF delta for a given change in scenario
  const getCfDelta = (patch: Partial<typeof s>) => {
    const newR = calculateRealEstate({ ...s, ...patch });
    const delta = newR.monthlyCashflow - r.monthlyCashflow;
    return `${delta > 0 ? "+" : ""}${formatPLN2(delta)} Zysk/m-c`;
  };

  const ownerMonthlyCosts =
    costs.management +
    costs.insurance +
    costs.reserve +
    (s.tenantPaysAdmin ? 0 : costs.admin) +
    (s.tenantPaysMedia ? 0 : costs.media);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Settings2 className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Parametry Inwestycji</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/5 hover:bg-accent/10 text-accent text-[11px] font-bold transition-all border border-accent/10 shadow-sm"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Zwiń wszystko
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Rozwiń wszystko
            </>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        {/* Sekcja 1: Nieruchomość */}
        <section data-section="1" className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full lg:order-1 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg leading-none">Nieruchomość</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Gotówka na start: <span className="text-foreground">{formatPLN(r.totalUpfront)}</span>
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-4 flex-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <NumField
                label="Cena mieszkania"
                value={s.purchasePrice}
                onChange={(v) => updateS({ purchasePrice: v })}
                feedback={
                  <>
                    <span className="text-muted-foreground">Kredyt: {formatPLN(r.loanAmount)}</span>
                  </>
                }
              />
              <SliderField
                label="Wkład własny"
                value={s.downPaymentPct}
                min={10}
                max={100}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => updateS({ downPaymentPct: v })}
                feedback={
                  <>
                    <span className="text-muted-foreground">{formatPLN((s.purchasePrice * s.downPaymentPct) / 100)}</span>
                  </>
                }
              />
              <NumField
                label="Remont / wykończenie"
                value={s.renovationCost}
                onChange={(v) => updateS({ renovationCost: v })}
              />
              <SliderField
                label="Remont finansowany z kredytu"
                value={s.renovationFinancedPct}
                min={0}
                max={100}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => updateS({ renovationFinancedPct: v })}
                feedback={
                  <span className="text-muted-foreground">
                    Finansowane: {formatPLN((s.renovationCost * s.renovationFinancedPct) / 100)}
                  </span>
                }
              />
              <NumField
                label="Czas remontu (mies.)"
                value={s.renovationMonths}
                onChange={(v) => updateS({ renovationMonths: v })}
                hint="Okres od początku inwestycji bez przychodów z najmu"
              />
              <NumField
                label="Poszukiwanie najemcy (mies.)"
                value={s.tenantSearchMonths}
                onChange={(v) => updateS({ tenantSearchMonths: v })}
                hint="Dodatkowe miesiące bez czynszu po remoncie"
              />
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">Typ nieruchomości</label>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => updateS({ marketType: "wtórny" })}
                      className={cn("text-xs py-2 rounded-lg border font-bold transition-all", s.marketType === "wtórny" ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted")}
                    >
                      Rynek Wtórny
                    </button>
                    <button
                      type="button"
                      onClick={() => updateS({ marketType: "pierwotny" })}
                      className={cn("text-xs py-2 rounded-lg border font-bold transition-all", s.marketType === "pierwotny" ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted")}
                    >
                      Rynek Pierwotny
                    </button>

                    <button
                      type="button"
                      onClick={() => updateS({ hasAgency: !s.hasAgency })}
                      className={cn("text-xs py-2 rounded-lg border font-bold transition-all w-full text-center flex items-center justify-center gap-2", s.hasAgency ? "bg-accent/10 text-accent border-accent/20" : "bg-card border-border hover:bg-muted text-muted-foreground")}
                    >
                      <div className={cn("w-3 h-3 rounded-sm border", s.hasAgency ? "bg-accent border-accent" : "border-muted-foreground")} />
                      Kupuję z agencją (+2%)
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right mt-1">
                    Koszty transakcyjne łącznie: <span className="font-bold text-foreground">{formatPLN(r.closingCosts)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sekcja 2: Kredyt */}
        <section data-section="2" className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full lg:order-3 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg leading-none">Kredyt</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium flex justify-between">
                <span>Rata: <span className="text-foreground">{formatPLN2(r.monthlyPmt)}</span></span>
                <span>Odsetki łącznie: <span className="text-destructive">{formatPLN(r.totalInterestPaid)}</span></span>
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-4 flex-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-xl">
                <button
                  type="button"
                  onClick={() => updateS({ mortgageType: "equal" })}
                  className={cn("text-[11px] py-2 px-3 rounded-lg transition-all flex flex-col items-center gap-1", s.mortgageType === "equal" ? "bg-card text-foreground shadow-sm font-bold border border-border/50" : "text-muted-foreground hover:bg-muted")}
                >
                  Raty równe
                  <div className="flex gap-px h-3 items-end opacity-50">
                    <div className="w-1.5 h-3 bg-current" /><div className="w-1.5 h-3 bg-current" /><div className="w-1.5 h-3 bg-current" /><div className="w-1.5 h-3 bg-current" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateS({ mortgageType: "decreasing" })}
                  className={cn("text-[11px] py-2 px-3 rounded-lg transition-all flex flex-col items-center gap-1", s.mortgageType === "decreasing" ? "bg-card text-foreground shadow-sm font-bold border border-border/50" : "text-muted-foreground hover:bg-muted")}
                >
                  Raty malejące
                  <div className="flex gap-px h-3 items-end opacity-50">
                    <div className="w-1.5 h-3 bg-current" /><div className="w-1.5 h-3 bg-current" /><div className="w-1.5 h-2 bg-current" /><div className="w-1.5 h-1.5 bg-current" />
                  </div>
                </button>
              </div>

              <SliderField
                label="Okres kredytowania"
                value={s.mortgageYears}
                min={5}
                max={35}
                step={1}
                format={(v) => `${v} lat`}
                onChange={(v) => updateS({ mortgageYears: v })}
              />
              <NumField
                label="Oprocentowanie kredytu"
                hint="Roczna stawka procentowa, np. 7.2%"
                value={s.mortgageRatePct}
                onChange={(v) => updateS({ mortgageRatePct: v })}
              />
              <NumField
                label="Ubezpieczenie kredytu (m-c)"
                value={s.mortgageInsuranceMonthly}
                onChange={(v) => updateS({ mortgageInsuranceMonthly: v })}
              />
            </div>
          )}
        </section>

        {/* Sekcja 3: Wynajem */}
        <section data-section="3" className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full lg:order-2 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg leading-none">Wynajem</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium flex justify-between">
                <span>Zysk co miesiąc: <span className={cn(r.monthlyCashflow >= 0 ? "text-success" : "text-destructive")}>{formatPLN2(r.monthlyCashflow)}</span></span>
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-4 flex-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <NumField
                label="Czynsz brutto od najemcy"
                value={s.monthlyRent}
                onChange={(v) => updateS({ monthlyRent: v })}
              />

              <div className="pt-2">
                <div className="flex flex-col gap-2 mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Koszty miesięczne</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateS({ tenantPaysAdmin: !s.tenantPaysAdmin })}
                      className={cn("text-xs py-2 rounded-lg border font-bold transition-all w-full text-center flex items-center justify-center gap-2", s.tenantPaysAdmin ? "bg-accent/10 text-accent border-accent/20" : "bg-card border-border hover:bg-muted text-muted-foreground")}
                    >
                      <div className={cn("w-3 h-3 rounded-sm border", s.tenantPaysAdmin ? "bg-accent border-accent" : "border-muted-foreground")} />
                      Najemca płaci czynsz admin.
                    </button>
                    <button
                      type="button"
                      onClick={() => updateS({ tenantPaysMedia: !s.tenantPaysMedia })}
                      className={cn("text-xs py-2 rounded-lg border font-bold transition-all w-full text-center flex items-center justify-center gap-2", s.tenantPaysMedia ? "bg-accent/10 text-accent border-accent/20" : "bg-card border-border hover:bg-muted text-muted-foreground")}
                    >
                      <div className={cn("w-3 h-3 rounded-sm border", s.tenantPaysMedia ? "bg-accent border-accent" : "border-muted-foreground")} />
                      Najemca płaci media
                    </button>
                  </div>
                </div>
                <div className="space-y-2 bg-muted/20 p-3 rounded-xl border border-border/50">
                  {[
                    { key: 'admin', label: 'Czynsz admin.', included: !s.tenantPaysAdmin },
                    { key: 'media', label: 'Media', included: !s.tenantPaysMedia },
                    { key: 'insurance', label: 'Ubezpieczenie', included: true },
                    { key: 'reserve', label: 'Rezerwa', included: true },
                    { key: 'management', label: 'Zarządzanie', included: true },
                  ].map((cost) => {
                    const val = costs[cost.key as keyof typeof costs];
                    const pct = ownerMonthlyCosts > 0 && cost.included ? (val / ownerMonthlyCosts) * 100 : 0;
                    return (
                      <div key={cost.key} className={cn("flex items-center gap-2 text-xs group", !cost.included && "opacity-60")}>
                        <span className="w-24 truncate text-muted-foreground">{cost.label}</span>
                        <input
                          type="number"
                          value={val || ""}
                          onChange={(e) => setCosts(prev => ({ ...prev, [cost.key]: Number(e.target.value) }))}
                          className="w-14 bg-transparent border-b border-border/50 focus:border-accent outline-none text-right font-mono"
                        />
                        <span className="text-muted-foreground">zł</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-2 flex">
                          <div className="h-full bg-accent/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-[9px] text-muted-foreground">
                          {cost.included ? `${pct.toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-1 pt-2 mt-1 border-t border-border/50">
                    <div className="flex justify-between items-center font-bold text-sm">
                      <span>Łącznie</span>
                      <span className="font-mono">{formatPLN(ownerMonthlyCosts)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Uwzględnia tylko koszty ponoszone przez właściciela.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">Metoda opodatkowania</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateS({ taxRatePct: 8.5 })}
                    className={cn("text-xs py-2 rounded-lg border font-bold transition-all", s.taxRatePct === 8.5 ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted")}
                  >
                    8.5% ryczałt
                  </button>
                  <button
                    onClick={() => updateS({ taxRatePct: 12.5 })}
                    className={cn("text-xs py-2 rounded-lg border font-bold transition-all", s.taxRatePct === 12.5 ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted")}
                  >
                    12.5% ryczałt
                  </button>
                  <button
                    onClick={() => updateS({ taxRatePct: 12 })}
                    className={cn("text-xs py-2 rounded-lg border font-bold transition-all", s.taxRatePct === 12 ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:bg-muted")}
                  >
                    12% (Skala)
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sekcja 4: Prognozy */}
        <section data-section="4" className="bg-card rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full lg:order-4 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg leading-none">Prognozy</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Wartość za {s.holdingYears} lat: <span className="text-success">{formatPLN(r.yearly[r.yearly.length - 1]?.propertyValue || s.purchasePrice)}</span>
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-4 flex-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <SliderField
                label="Wzrost czynszu rocznie"
                value={s.rentGrowthPct}
                min={0}
                max={10}
                step={0.5}
                format={(v) => `${v}%`}
                onChange={(v) => updateS({ rentGrowthPct: v })}
              />
              <SliderField
                label="Wzrost wartości nieruchomości"
                value={s.appreciationPct}
                min={-5}
                max={15}
                step={0.5}
                format={(v) => `${v}%`}
                onChange={(v) => updateS({ appreciationPct: v })}
              />
              <SliderField
                label="Okres analizy (lata)"
                value={s.holdingYears}
                min={1}
                max={30}
                step={1}
                format={(v) => `${v} lat`}
                onChange={(v) => updateS({ holdingYears: v })}
              />
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-medium">Sprzedaj mieszkanie po okresie analizy</p>
                  <p className="text-xs text-muted-foreground">Jeśli włączone, kalkulacja uwzględnia zysk ze sprzedaży po zakończeniu analizowanego okresu.</p>
                </div>
                <Switch checked={s.sellAtEnd} onCheckedChange={(value) => updateS({ sellAtEnd: value })} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
