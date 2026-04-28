import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { actions, getCachedMembers, getMemberDisplayName, useAppState } from "@/lib/store";
import { SpousePanel } from "@/components/SpousePanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, RotateCcw } from "lucide-react";
import { calculateSalary, calculateAnnualAverageNet, computeJointFiling, formatPLN } from "@/lib/salary";
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
      { title: "Zarobki — Saldeo" },
      {
        name: "description",
        content:
          "Kalkulator wynagrodzeń UoP z PPK, autorskimi KUP, benefitami (w tym samochód służbowy) i ekwiwalentem za pracę zdalną.",
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
  const householdId = getActiveHouseholdId();

  // Derive members from cached profiles (computed, no state)
  const members = useMemo(() => {
    const cached = getCachedMembers();

    return cached
      .slice() // prevent mutation
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

  // Household summary calculations
  const totalHouseholdNet = spouses.reduce((sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings), 0);
  const joint = spouses.length === 2 ? computeJointFiling(spouses[0].inputs, spouses[1].inputs, globalSettings) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Zarobki
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Ile zostaje <span className="italic text-accent">w kieszeni?</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Pełne polskie zasady 2025: ZUS, zdrowotna, PIT (oba progi), KUP standardowe i autorskie
            (50%), PPK, benefity, ekwiwalent za pracę zdalną.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {spouses.length >= 2 && (
            <label className="flex items-center gap-2 text-sm bg-card border border-border rounded-full px-3 py-1.5">
              <Switch checked={jointFiling} onCheckedChange={(v) => actions.setJointFiling(v)} />
              <span className="hidden sm:inline">Rozliczenie wspólne</span>
              <span className="sm:hidden text-xs">Wspólne</span>
            </label>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => actions.addSpouse()}>
              <Plus className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Dodaj osobę</span><span className="sm:hidden">Dodaj</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Zresetuj dane"
                  className="text-muted-foreground"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Zresetować dane?</AlertDialogTitle>
                <AlertDialogDescription>
                  Spowoduje to wyczyszczenie wszystkich danych gospodarstwa (wynagrodzenia, wydatki,
                  aktywa i ustawienia).
                  Tej operacji nie można cofnąć.
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction onClick={() => actions.reset()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Wyczyść dane
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-2 gap-6">
        {spouses.map((s) => (
          <SpousePanel key={s.id} spouse={s} canDelete={spouses.length > 1} memberOptions={members} />
        ))}
      </div>

      {spouses.length === 0 && (
        <div className="bg-card rounded-2xl p-8 border border-dashed border-border text-center">
          <p className="text-base font-medium">Brak osób w gospodarstwie.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Dodaj pierwszą osobę, aby rozpocząć kalkulacje wynagrodzeń i synchronizację danych.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => actions.addSpouse()}>
            <Plus className="w-4 h-4 mr-1" /> Dodaj pierwszą osobę
          </Button>
        </div>
      )}

      {spouses.length === 2 && (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-accent to-accent/70 p-6 text-accent-foreground flex flex-wrap items-center justify-between gap-6 shadow-[var(--shadow-warm)] mt-8">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-xs text-accent-foreground/70 uppercase tracking-wider font-semibold mb-1">
              Łączne netto gospodarstwa / miesiąc
            </p>
            <p className="font-display text-4xl tabular-nums">
              {formatPLN(totalHouseholdNet)}
            </p>
          </div>
          {jointFiling && joint && joint.savings > 0 && (
            <div className="text-right relative">
              <p className="text-xs text-accent-foreground/70 font-semibold mb-1">
                Zysk z rozliczenia wspólnego
              </p>
              <p className="text-2xl font-bold tabular-nums">
                +{formatPLN(joint.savings)} <span className="text-sm font-normal opacity-80">/ rok</span>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
