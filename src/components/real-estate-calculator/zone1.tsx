import { cn } from "@/lib/utils";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { useRealEstate } from "./context";
import { CheckCircle2, AlertTriangle, BarChart2, XCircle, Info } from "lucide-react";
import type { InvestmentVerdict } from "@/lib/finance";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ScenarioHeader() {
  const { r, minRent, verdict, rentMargin, rentMarginPct, cashflowPositive, s, steadyCashflow } = useRealEstate();
  const vacancyMonths = Math.max(0, (s.renovationMonths || 0) + (s.tenantSearchMonths || 0));

  const verdictMeta: Record<InvestmentVerdict, { label: string; desc: string; icon: typeof CheckCircle2; color: string }> = {
    rentowna: { label: "Opłacalna", desc: "Czynsz pokrywa koszty.", icon: CheckCircle2, color: "text-success bg-success/10 border-success/20" },
    graniczna: { label: "Na granicy", desc: "Zysk waha się koło zera.", icon: AlertTriangle, color: "text-warning-foreground bg-warning/10 border-warning/20" },
    kapitalowa: { label: "Zysk ze sprzedaży", desc: "Dokładasz co miesiąc.", icon: BarChart2, color: "text-accent bg-accent/10 border-accent/20" },
    ryzykowna: { label: "Wysokie ryzyko", desc: "Nie pokrywa kosztów.", icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/20" },
  };

  const vm = verdictMeta[verdict];
  const VerdictIcon = vm.icon;

  // Rent margin progress calculation
  // Fill = effective rent / break-even rent
  const fillPct = minRent > 0 ? Math.min(100, Math.max(0, (s.monthlyRent / minRent) * 100)) : 100;
  const isRentHealthy = s.monthlyRent >= minRent;

  return (
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 pb-4 pt-2 mb-6 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Kalkulator nieruchomości</h2>
        </div>

        <div className={cn("hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold shadow-sm", vm.color)}>
          <VerdictIcon className="w-3.5 h-3.5" />
          {vm.label}
        </div>
      </div>

      {/* 3 Hero Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* CF Card */}
        <div className={cn(
          "rounded-2xl border p-3 sm:p-4 transition-all flex flex-col justify-center",
          cashflowPositive ? "bg-success/10 border-success/30 shadow-warm" : "bg-destructive/10 border-destructive/30 shadow-sm"
        )}>
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Zysk miesięczny</p>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors focus:outline-none">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-center leading-relaxed">
                  <p className="font-semibold mb-0.5">Zysk przy pełnym wynajmie</p>
                  <p>Miesięczny zysk przy normalnym, pełnym wynajmie — bez uwzględniania pustostanu.</p>
                  {vacancyMonths > 0 && (
                    <p className="mt-1 opacity-80">Rok&nbsp;1 (z {vacancyMonths}&nbsp;m-c pustostanu) pokazany niżej jako wartość pomocnicza.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className={cn("font-display text-xl sm:text-3xl tracking-tight leading-none", cashflowPositive ? "text-success" : "text-destructive")}>
            {steadyCashflow >= 0 ? "+" : ""}{formatPLN2(steadyCashflow)}
          </p>
          {vacancyMonths > 0 && (
            <p className={cn("text-[9px] mt-1 leading-tight", r.monthlyCashflow >= 0 ? "text-success/70" : "text-warning-foreground")}>
              Rok 1 śr: {r.monthlyCashflow >= 0 ? "+" : ""}{formatPLN2(r.monthlyCashflow)}
            </p>
          )}
        </div>

        {/* IRR Card */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Rentowność roczna</p>
          <p className="font-display text-xl sm:text-3xl tracking-tight leading-none">{r.irrAnnualPct.toFixed(1)}%</p>
        </div>

        {/* Min Rent Card */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Min. czynsz</p>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors focus:outline-none">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-center leading-relaxed">
                  <p className="font-semibold mb-0.5">Próg opłacalności</p>
                  <p>Czynsz pokrywający ratę kredytu, koszty stałe i podatek przy pełnym wynajmie.</p>
                  {(s.renovationMonths || 0) + (s.tenantSearchMonths || 0) > 0 && (
                    <p className="mt-1 opacity-80">Pustostan roku&nbsp;1 wpływa na <em>Zysk miesięczny</em>, nie na ten próg.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="font-display text-xl sm:text-3xl tracking-tight leading-none">{formatPLN(minRent)}</p>
          {(s.renovationMonths || 0) + (s.tenantSearchMonths || 0) > 0 && (
            <p className="text-[9px] text-warning-foreground mt-1 leading-tight">
              Rok 1: {(s.renovationMonths || 0) + (s.tenantSearchMonths || 0)} m-c bez czynszu
            </p>
          )}
        </div>
      </div>

      {/* Rent Margin Progress Bar */}
      <div className="px-1">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Margines czynszu</span>
          <span className={cn("text-xs font-bold", isRentHealthy ? "text-success" : "text-destructive")}>
            Twój czynsz: {formatPLN(s.monthlyRent)} ({rentMarginPct >= 0 ? "+" : ""}{rentMarginPct.toFixed(0)}%)
          </span>
        </div>
        <div className="h-2 bg-muted/40 rounded-full overflow-hidden relative border border-border/50">
          <div
            className={cn("h-full transition-all duration-500", isRentHealthy ? "bg-success" : "bg-destructive")}
            style={{ width: `${Math.min(100, fillPct)}%` }}
          />
          {/* Break-even marker line if rent is higher than break even */}
          {isRentHealthy && minRent > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-background shadow-sm"
              style={{ left: `${(minRent / s.monthlyRent) * 100}%` }}
              title={`Próg opłacalności: ${formatPLN(minRent)}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
