import { useState } from "react";
import { useRealEstate } from "./context";
import { formatPLN, formatPLN2 } from "@/lib/salary";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InputPanel } from "./zone2";
import { InsightPanel } from "./zone3";

export function MobileWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const { r, minRent, cashflowPositive, s } = useRealEstate();

  const handleNext = () => setStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
  const handlePrev = () => setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);

  // Render a specific section of Zone 2 based on the step
  // Since Zone 2 is built as one component, we can use CSS to hide/show sections,
  // or we can extract the sections. But CSS child targeting is easiest here.
  // Actually, wait, Zone 2 is one component. Let's just render the relevant form inside here.
  // To avoid code duplication, I will reuse InputPanel but hide other sections with CSS.

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-background">
      {/* Sticky Mini Verdict Header */}
      <div
        className={cn(
          "sticky top-0 z-50 p-4 flex justify-between items-center border-b shadow-sm transition-colors",
          cashflowPositive
            ? "bg-success/10 border-success/20"
            : "bg-destructive/10 border-destructive/20",
        )}
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            CF / Miesiąc
          </p>
          <p
            className={cn(
              "font-display text-2xl leading-none",
              cashflowPositive ? "text-success" : "text-destructive",
            )}
          >
            {cashflowPositive ? "+" : ""}
            {formatPLN2(r.monthlyCashflow)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            Min. czynsz
          </p>
          <p className="font-mono text-sm font-bold">{formatPLN(minRent)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted/30 w-full relative">
        <div
          className="absolute top-0 left-0 h-full bg-accent transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <div className="flex-1 p-4 pb-24">
        {step === 1 && (
          <div className="space-y-4 fade-in">
            <h2 className="font-display text-2xl mb-6">1. Nieruchomość</h2>
            <div className="[&_section[data-section]:not([data-section='1'])]:hidden">
              <InputPanel />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4 fade-in">
            <h2 className="font-display text-2xl mb-6">2. Kredyt</h2>
            <div className="[&_section[data-section]:not([data-section='2'])]:hidden">
              <InputPanel />
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4 fade-in">
            <h2 className="font-display text-2xl mb-6">3. Wynajem & Prognozy</h2>
            <div className="[&_section[data-section]:not([data-section='3']):not([data-section='4'])]:hidden">
              <InputPanel />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4 fade-in">
            <h2 className="font-display text-2xl mb-6">4. Wyniki</h2>
            <InsightPanel />
          </div>
        )}
      </div>

      {/* Bottom Nav Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 flex justify-between z-50">
        <button
          onClick={handlePrev}
          disabled={step === 1}
          className="px-4 py-3 rounded-xl border border-border bg-card text-sm font-bold disabled:opacity-50 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Wstecz
        </button>
        <button
          onClick={handleNext}
          disabled={step === 4}
          className="px-6 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          {step === 3 ? "Zobacz Wyniki" : "Dalej"} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
