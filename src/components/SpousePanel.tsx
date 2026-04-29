import {
  calculateMemberAnnualAverageNet,
  formatPLN,
  formatPLN2,
  isEligibleForJointFiling,
  type Income,
} from "@/lib/salary";
import { IncomePanel } from "./IncomePanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, type Spouse, useAppState } from "@/lib/store";
import { Trash2, ChevronDown, User, Zap, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useMemo, useState, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export function SpousePanel({
  spouse,
  canDelete,
  memberOptions,
}: {
  spouse: Spouse;
  canDelete: boolean;
  memberOptions?: { user_id: string; label: string }[];
}) {
  const globalSettings = useAppState((s) => s.settings);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const averageMonthlyNet = useMemo(() => calculateMemberAnnualAverageNet(spouse, globalSettings), [spouse.incomes, globalSettings]);
  const isEligible = useMemo(() => isEligibleForJointFiling(spouse), [spouse.incomes]);

  const filteredMembers = useMemo(() => {
    if (!memberOptions) return [];
    const searchTerm = spouse.name.toLowerCase();
    return memberOptions.filter((m) => m.label.toLowerCase().includes(searchTerm));
  }, [spouse.name, memberOptions]);

  const handleMemberSelect = (memberId: string, memberLabel: string) => {
    actions.updateSpouse(spouse.id, { name: memberLabel, assignedUserId: memberId });
    setShowMemberDropdown(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Info with Member Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center border-2 border-background shadow-sm">
            <User className="h-6 w-6 text-accent" />
          </div>
          <div className="relative" ref={dropdownRef}>
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 <input
                    className="font-bold text-xl leading-tight bg-transparent border-none p-0 focus:ring-0 w-48 hover:bg-muted/50 rounded px-1 transition-colors"
                    value={spouse.name}
                    onChange={(e) => actions.updateSpouse(spouse.id, { name: e.target.value })}
                    onFocus={() => setShowMemberDropdown(true)}
                  />
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => actions.removeSpouse(spouse.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
               </div>
               <p className="text-xs text-muted-foreground font-medium pl-1">
                 Średnio <span className="text-success font-bold">{formatPLN(averageMonthlyNet)} netto</span> miesięcznie
               </p>
            </div>

            {showMemberDropdown && filteredMembers.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-border bg-muted/30">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Sugerowani członkowie</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.user_id}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group"
                      onClick={() => handleMemberSelect(m.user_id, m.label)}
                    >
                      <span className="font-medium">{m.label}</span>
                      <Zap className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isEligible && (
          <div className="px-3 py-1.5 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-2 animate-in fade-in zoom-in-95 self-start sm:self-center">
             <Zap className="h-3.5 w-3.5 text-warning fill-warning/20" />
             <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-warning uppercase tracking-wider leading-none">Brak ulgi wspólnej</span>
                <span className="text-[9px] text-warning/80 font-medium leading-none mt-0.5">Wykryto kontrakt B2B (Liniowy/Ryczałt)</span>
             </div>
          </div>
        )}
      </div>

      {/* Incomes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Kontrakty i Przychody</h4>
           <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{spouse.incomes.length}</span>
        </div>
        
        {spouse.incomes.map((inc) => (
          <IncomePanel key={inc.id} spouseId={spouse.id} income={inc} />
        ))}

        {spouse.incomes.length === 0 && (
          <div className="py-12 border-2 border-dashed border-muted rounded-3xl flex flex-col items-center justify-center text-center px-4 bg-muted/5">
            <div className="p-4 rounded-full bg-muted/30 mb-4">
               <Briefcase className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h4 className="font-bold text-base text-muted-foreground">Brak zdefiniowanych przychodów</h4>
            <p className="text-sm text-muted-foreground/60 mt-2 max-w-[260px]">
              Każdy domownik może posiadać wiele źródeł dochodu (np. etat + B2B).
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <Button
            variant="outline"
            className="rounded-2xl border-dashed border-2 hover:border-accent hover:bg-accent/5 hover:text-accent transition-all h-16 flex-col gap-1 py-0 shadow-sm active:scale-[0.98]"
            onClick={() => actions.addIncome(spouse.id, "UoP")}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="font-bold">Umowa o pracę</span>
            </div>
            <span className="text-[10px] opacity-60 font-medium">UoP / Zlecenie</span>
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl border-dashed border-2 hover:border-accent hover:bg-accent/5 hover:text-accent transition-all h-16 flex-col gap-1 py-0 shadow-sm active:scale-[0.98]"
            onClick={() => actions.addIncome(spouse.id, "B2B")}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="font-bold">Kontrakt B2B</span>
            </div>
            <span className="text-[10px] opacity-60 font-medium">JDG / Spółka</span>
          </Button>
        </div>
      </div>

      {spouse.incomes.length > 1 && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/10 mt-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
             <Landmark className="h-16 w-16 text-accent" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Łączny dochód roczny netto</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-accent tabular-nums tracking-tight">
                {formatPLN(averageMonthlyNet * 12)}
              </span>
              <span className="text-sm font-bold text-accent/60 italic">netto / rok</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Landmark(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7 12 2" />
    </svg>
  );
}
