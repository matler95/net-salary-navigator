import React, { useEffect, useState } from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label,
  value,
  numberValue,
  sub,
  tone = "default",
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  numberValue?: number;
  sub?: React.ReactNode;
  tone?: "default" | "success" | "destructive" | "warning";
  icon?: LucideIcon;
  delta?: {
    value: number | string;
    isPositive: boolean;
  };
}) {
  const [displayValue, setDisplayValue] = useState(numberValue !== undefined ? 0 : null);

  useEffect(() => {
    if (numberValue !== undefined) {
      let start = 0;
      const end = numberValue;
      const duration = 1200;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function: easeOutExpo
        const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = start + (end - start) * easeOutExpo;

        setDisplayValue(current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [numberValue]);

  const toneConfig = {
    default: {
      text: "text-foreground",
      bg: "bg-card",
      wash: "bg-accent/5",
      icon: "text-muted-foreground",
    },
    success: {
      text: "text-success",
      bg: "bg-success-soft/30",
      wash: "bg-success/10",
      icon: "text-success",
    },
    destructive: {
      text: "text-destructive",
      bg: "bg-destructive-soft/30",
      wash: "bg-destructive/10",
      icon: "text-destructive",
    },
    warning: {
      text: "text-warning",
      bg: "bg-warning-soft/30",
      wash: "bg-warning/10",
      icon: "text-warning",
    }
  };

  const config = toneConfig[tone] || toneConfig.default;

  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] p-6 border border-border shadow-warm transition-all hover:shadow-md hover:-translate-y-0.5 duration-300 ${config.bg}`}>
      {/* Gradient Wash */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[64px] pointer-events-none opacity-50 ${config.wash}`} />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">{label}</p>
          {Icon && <Icon className={`w-5 h-5 opacity-20 ${config.icon}`} />}
        </div>
        
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className={`font-display text-3xl font-semibold tabular-nums tracking-tight ${config.text}`}>
            {displayValue !== null 
              ? displayValue.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) 
              : value}
          </p>
          {delta && (
            <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${delta.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {delta.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {delta.value}
            </div>
          )}
        </div>

        {sub && <div className="text-xs text-muted-foreground mt-2 font-medium opacity-80">{sub}</div>}
      </div>
    </div>
  );
}
