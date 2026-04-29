import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { actions, getCachedMembers, getMemberDisplayName, useAppState } from "@/lib/store";
import { SpousePanel } from "@/components/SpousePanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, RotateCcw, Users, Zap, Wallet, Info, ArrowRight, ShieldCheck } from "lucide-react";
import {
  calculateSalary,
  calculateAnnualAverageNet,
  computeJointFiling,
  formatPLN,
} from "@/lib/salary";
import { getActiveHouseholdId } from "@/lib/store";
import { useAuthSession } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/wynagrodzenia")({
  head: () => ({
    meta: [
      { title: "Kalkulator Wynagrodzeń — Saldeo" },
      {
        name: "description",
        content:
          "Kalkulator wynagrodzeń UoP z PPK, autorskimi KUP, benefitami i ryczałtem za samochód służbowy. Sprawdź swoje netto w 2025.",
      },
    ],
  }),
  component: SalariesPage,
});

function SalariesPage() {
  const spouses = useAppState((s) => s.spouses);
  const jointFiling = useAppState((s) => s.jointFiling);
  const globalSettings = useAppState((s) => s.globalSettings);
  const { session } = useAuthSession();

  const members = useMemo(() => {
    const cached = getCachedMembers();
    return cached
      .slice()
      .sort((a, b) => {
        const nameA = getMemberDisplayName(a);
        const nameB = getMemberDisplayName(b);
        return nameA.localeCompare(nameB, "pl", { sensitivity: "base" });
      })
      .map((member) => ({
        user_id: member.user_id,
        role: member.role,
        label:
          member.user_id === session?.user.id
            ? `Ty (${getMemberDisplayName(member)})`
            : getMemberDisplayName(member),
      }));
  }, [session?.user.id]);

  const totalHouseholdNet = spouses.reduce(
    (sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings),
    0,
  );
  const joint =
    spouses.length === 2
      ? computeJointFiling(spouses[0].inputs, spouses[1].inputs, globalSettings)
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Page Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-widest border border-accent/10">
              Kalkulator 2025
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Users className="w-3.5 h-3.5" />
              {spouses.length} {spouses.length === 1 ? "osoba" : "osoby"} w budżecie
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight">
            Twoje{" "}
            <span className="italic text-accent decoration-accent/30 underline underline-offset-8">
              wynagrodzenie
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Sprawdź ile dostaniesz na rękę po uwzględnieniu wszystkich składek, PPK i benefitów.
            Automatycznie wyliczamy progi podatkowe i ulgi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {spouses.length >= 2 && (
            <div className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                  Rozliczenie wspólne
                </span>
                <span className="text-xs font-medium text-foreground">Optymalizacja PIT</span>
              </div>
              <Switch checked={jointFiling} onCheckedChange={(v) => actions.setJointFiling(v)} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="lg"
              onClick={() => actions.addSpouse()}
              className="rounded-2xl px-6 h-14 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5 mr-2" /> Dodaj Osobę
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 rounded-2xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogTitle className="font-display text-2xl">
                  Zresetować dane?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  Spowoduje to wyczyszczenie wszystkich informacji o wynagrodzeniach, wydatkach i
                  aktywach. Tej operacji nie można cofnąć.
                </AlertDialogDescription>
                <AlertDialogFooter className="gap-3">
                  <AlertDialogCancel className="rounded-xl">Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => actions.reset()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                  >
                    Wyczyść wszystko
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid xl:grid-cols-2 gap-8 items-start">
        {spouses.map((s) => (
          <SpousePanel
            key={s.id}
            spouse={s}
            canDelete={spouses.length > 1}
            memberOptions={members}
          />
        ))}

        {spouses.length === 0 && (
          <div className="xl:col-span-2 bg-card rounded-[3rem] p-16 border border-dashed border-border/60 flex flex-col items-center text-center space-y-6 animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-[2.5rem] bg-accent-soft flex items-center justify-center text-accent">
              <Zap className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="font-display text-3xl font-semibold">Zacznij tutaj</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Dodaj siebie lub domowników, aby obliczyć wspólny budżet i zobaczyć prognozy na 2025
                rok.
              </p>
            </div>
            <Button
              size="xl"
              onClick={() => actions.addSpouse()}
              className="rounded-3xl shadow-xl shadow-primary/20"
            >
              <Plus className="w-5 h-5 mr-3" /> Dodaj pierwszą osobę
            </Button>
          </div>
        )}
      </div>

      {/* Household Summary Card */}
      {spouses.length >= 2 && (
        <div className="relative overflow-hidden bg-card rounded-[3rem] border border-border p-10 shadow-warm animate-in slide-in-from-top-8 duration-700">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-success/5 to-transparent pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-accent text-white flex items-center justify-center shadow-lg">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-2">
                  Razem Gospodarstwo (Netto)
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl sm:text-6xl font-bold text-accent tabular-nums leading-none">
                    {formatPLN(totalHouseholdNet)}
                  </span>
                  <span className="text-muted-foreground font-medium text-lg">/ mc</span>
                </div>
              </div>
            </div>

            {jointFiling && joint && joint.savings > 0 && (
              <div className="bg-success-soft/30 backdrop-blur-sm rounded-[2rem] p-8 border border-success/20 flex flex-col items-center md:items-end text-center md:text-right min-w-[280px]">
                <div className="flex items-center gap-2 text-success font-bold text-[10px] uppercase tracking-widest mb-3">
                  <Zap className="w-3.5 h-3.5 fill-success" /> Oszczędność Podatkowa
                </div>
                <div className="text-4xl font-display font-bold text-success-foreground tabular-nums mb-1">
                  +{formatPLN(joint.savings)}
                </div>
                <p className="text-xs text-success/70 font-bold uppercase tracking-tighter italic">
                  Roczny zysk z rozliczenia wspólnie
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="pt-10 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6 text-muted-foreground text-xs font-medium">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            Dane zapisywane w chmurze
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            Stan prawny na 2025
          </div>
        </div>
        <div className="flex items-center gap-2 hover:text-accent transition-colors cursor-pointer group">
          Zobacz szczegółową analizę podatkową{" "}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </footer>
    </div>
  );
}
