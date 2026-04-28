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
      { title: "Wynagrodzenia — Płaca.netto" },
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
    return cached.map((member) => ({
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
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
            Wynagrodzenia
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Brutto → <span className="italic text-accent">netto</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Pełne polskie zasady 2025: ZUS, zdrowotna, PIT (oba progi), KUP standardowe i autorskie
            (50%), PPK, benefity (w tym samochód służbowy), bony żywieniowe, ekwiwalent za pracę
            zdalną.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {spouses.length >= 2 && (
            <label className="flex items-center gap-2 text-sm bg-card border border-border rounded-full px-3 py-1.5">
              <Switch checked={jointFiling} onCheckedChange={(v) => actions.setJointFiling(v)} />
              Rozliczenie wspólne
            </label>
          )}
          <Button variant="outline" size="sm" onClick={() => actions.addSpouse()}>
            <Plus className="w-4 h-4 mr-1" /> Dodaj osobę
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
        <div className="bg-muted/40 rounded-2xl p-6 border border-border flex flex-wrap items-center justify-between gap-6 shadow-sm mt-8">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              Łączne netto gospodarstwa (średnia roczna)
            </p>
            <p className="font-display text-4xl tabular-nums text-accent">
              {formatPLN(totalHouseholdNet)}
            </p>
          </div>
          {jointFiling && joint && joint.savings > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-semibold mb-1">
                Zysk z rozliczenia wspólnego
              </p>
              <p className="text-2xl font-bold text-success tabular-nums">
                +{formatPLN(joint.savings)} <span className="text-sm font-normal">/ rok</span>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
