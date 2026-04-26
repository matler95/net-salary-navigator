import { createFileRoute } from "@tanstack/react-router";
import { SalaryCalculator } from "@/components/SalaryCalculator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kalkulator wynagrodzeń UoP 2025 — netto z brutto" },
      {
        name: "description",
        content:
          "Precyzyjny kalkulator netto z brutto na umowie o pracę. Uwzględnia ZUS, PIT, KUP, PPK, benefity (LuxMed, Multisport), bony żywieniowe i ekwiwalent za pracę zdalną.",
      },
      { property: "og:title", content: "Kalkulator wynagrodzeń UoP 2025" },
      {
        property: "og:description",
        content: "Netto z brutto z PPK, benefitami, KUP i ekwiwalentem za pracę zdalną.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[image:var(--gradient-accent)] flex items-center justify-center text-accent-foreground font-display font-bold text-lg shadow-[var(--shadow-card)]">
              ₧
            </div>
            <div>
              <p className="font-display text-lg leading-tight">Płaca.netto</p>
              <p className="text-xs text-muted-foreground leading-tight">
                Kalkulator UoP · Polska 2025
              </p>
            </div>
          </div>
          <a
            href="https://www.podatki.gov.pl/pit/abc-podatkow-dochodowych/skala-podatkowa/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            Źródło: podatki.gov.pl ↗
          </a>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">
            Umowa o pracę · 2025
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-foreground">
            Ile naprawdę
            <br />
            <span className="italic text-accent">zostaje na rękę.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-5 max-w-xl leading-relaxed">
            Kalkulator z prawdziwego zdarzenia — uwzględnia KUP, PIT-2, oba progi podatkowe, PPK,
            benefity, bony żywieniowe i ekwiwalent za pracę zdalną.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <SalaryCalculator />
      </section>

      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-muted-foreground space-y-2">
          <p>
            Wartości orientacyjne. Składka wypadkowa pracodawcy przyjęta jako 1.67% (średnia).
            Składka chorobowa zakłada dobrowolne ubezpieczenie pracownika. Ulga dla młodych dotyczy
            osób do 26 r.ż. do limitu 85 528 zł / rok.
          </p>
          <p>
            Stawki: emerytalna 9.76%, rentowa 1.5%, chorobowa 2.45%, zdrowotna 9% (niedoliczana do
            podatku od 2022). PIT 12% do 120 000 zł, 32% powyżej. Kwota wolna 30 000 zł / rok.
          </p>
        </div>
      </footer>
    </main>
  );
}
