import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kalkulatory")({
  head: () => ({
    meta: [
      { title: "Kalkulatory - Saldeo" },
      {
        name: "description",
        content: "Scenariusz mieszkania pod wynajem z hipoteką, ROI i wykresami.",
      },
    ],
  }),
  component: CalculatorsPage,
});

function CalculatorsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <header className="flex flex-col gap-6 relative">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
            Kalkulatory
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Symuluj <span className="italic text-accent">scenariusze</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Sprawdź czy kupno mieszkania na wynajem faktycznie Ci się opłaci. Policz zyski, raty
            kredytu i koszty.
          </p>
        </div>
      </header>

      <RealEstateCalculator />
    </main>
  );
}

import { RealEstateCalculatorV2 as RealEstateCalculator } from "@/components/real-estate-calculator";
