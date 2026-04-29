import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { actions, getCachedMembers, getMemberDisplayName, useAppState } from "@/lib/store";
import { SpousePanel } from "@/components/SpousePanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, RotateCcw, Users, UserPlus, PartyPopper, ReceiptText } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/wynagrodzenia")({
  head: () => ({
    meta: [
      { title: "Zarobki - Saldeo" },
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

  const totalHouseholdNet = spouses.reduce((sum, s) => sum + calculateAnnualAverageNet(s.inputs, globalSettings), 0);
  const joint = spouses.length === 2 ? computeJointFiling(spouses[0].inputs, spouses[1].inputs, globalSettings) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">
            Zarobki netto
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">
            Ile zostaje <span className="italic text-accent">w kieszeni?</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Pełne wyliczenie UoP 2025 - ZUS, zdrowotna, PIT, PPK i benefity. Dodaj wszystkich pracujących domowników.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {spouses.length >= 2 && (
            <div className="flex items-center gap-3 bg-accent-soft/30 border border-accent/20 rounded-xl px-4 py-2.5 shadow-sm transition-colors hover:bg-accent-soft/50 cursor-pointer" onClick={() => actions.setJointFiling(!jointFiling)}>
              <div className="bg-accent/10 p-1.5 rounded-lg text-accent">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 pr-2">
                <p className="text-sm font-semibold">Rozliczenie wspólne</p>
              </div>
              <Switch checked={jointFiling} />
            </div>
          )}

          <Button
            onClick={() => actions.addSpouse()}
            className="h-12 sm:h-11 rounded-xl px-6 bg-accent-gradient text-accent-foreground shadow-warm hover:opacity-90 transition-opacity flex items-center gap-2 text-sm font-bold"
          >
            <UserPlus className="w-4 h-4" /> Dodaj osobę
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Zresetuj dane"
                className="h-12 sm:h-11 w-12 sm:w-11 rounded-xl text-muted-foreground border-border bg-card shadow-sm hover:bg-muted"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl sm:max-w-md">
              <AlertDialogTitle className="font-display text-xl">Zresetować dane?</AlertDialogTitle>
              <AlertDialogDescription>
                Spowoduje to wyczyszczenie wszystkich danych gospodarstwa (wynagrodzenia, wydatki, aktywa). Tej operacji nie można cofnąć.
              </AlertDialogDescription>
              <AlertDialogFooter className="mt-6">
                <AlertDialogCancel className="rounded-xl">Anuluj</AlertDialogCancel>
                <AlertDialogAction onClick={() => actions.reset()} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none shadow-sm">
                  Wyczyść dane
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {spouses.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Jeszcze nikogo nie ma"
          description="Dodaj pierwszą osobę, wpisz wynagrodzenie brutto, a Saldeo dokładnie wyliczy ile zostanie na rękę, pomagając w zaplanowaniu budżetu."
          className="my-12 max-w-2xl mx-auto"
        />
      ) : (
        <div className="grid xl:grid-cols-2 gap-6 lg:gap-8 animate-fade-up">
          {spouses.map((s) => (
            <SpousePanel key={s.id} spouse={s} canDelete={spouses.length > 1} memberOptions={members} />
          ))}
        </div>
      )}

      {spouses.length === 2 && (
        <div className="mt-12 bg-warm-gradient rounded-2xl p-6 sm:p-10 border border-border shadow-elevated flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="relative z-10 flex-1 w-full text-center md:text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/50 font-bold mb-1">
              Razem na rękę
            </p>
            <p className="font-display text-5xl tabular-nums text-foreground">
              {formatPLN(totalHouseholdNet)} <span className="text-xl text-foreground/50 font-sans">/ m-c</span>
            </p>
          </div>

          {jointFiling && joint && joint.savings > 0 && (
            <div className="relative z-10 bg-success/10 border border-success/20 rounded-2xl p-4 flex items-start gap-3 w-full md:w-auto">
              <div className="bg-success text-success-foreground p-2 rounded-xl shadow-warm">
                <PartyPopper className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-success font-bold mb-0.5">
                  Zysk z rozliczenia wspólnego
                </p>
                <p className="font-mono text-xl font-bold text-success tabular-nums leading-none mt-1">
                  +{formatPLN(joint.savings)} <span className="text-xs font-sans text-success/70">rocznie</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
