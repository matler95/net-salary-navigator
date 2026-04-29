import React, { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "default" | "success" | "destructive" | "warning" | "accent";
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label?: string };
  gradient?: boolean;
  animate?: boolean;
  interactive?: boolean;
  className?: string;
}

const TONE_VALUE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default:     "text-foreground",
  success:     "text-success",
  destructive: "text-destructive",
  warning:     "text-warning-foreground",
  accent:      "text-accent",
};

const TONE_ICON_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default:     "bg-foreground/10 text-foreground/50",
  success:     "bg-success/12 text-success/70",
  destructive: "bg-destructive/12 text-destructive/70",
  warning:     "bg-warning/12 text-warning-foreground/70",
  accent:      "bg-accent/12 text-accent/70",
};

const TONE_GRADIENT_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default:     "",
  success:     "from-[oklch(0.56_0.14_148/0.06)] to-transparent",
  destructive: "from-[oklch(0.58_0.19_25/0.06)] to-transparent",
  warning:     "from-[oklch(0.74_0.13_75/0.07)] to-transparent",
  accent:      "from-[oklch(0.56_0.13_175/0.07)] to-transparent",
};

function useCountUp(active: boolean, rawValue: string): string {
  const [displayed, setDisplayed] = useState(rawValue);
  const rafRef = useRef<number | null>(null);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!active || prefersReduced) {
      setDisplayed(rawValue);
      return;
    }
    // Extract numeric portion
    const match = rawValue.match(/([\d\s]+(?:[,.]\d+)?)/);
    if (!match) {
      setDisplayed(rawValue);
      return;
    }
    const numStr = match[1].replace(/\s/g, "").replace(",", ".");
    const target = parseFloat(numStr);
    if (isNaN(target)) {
      setDisplayed(rawValue);
      return;
    }
    const prefix = rawValue.slice(0, match.index);
    const suffix = rawValue.slice((match.index ?? 0) + match[1].length);
    const duration = 600;
    const start = performance.now();
    const fmt = new Intl.NumberFormat("pl-PL");

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // cubic-bezier(0.16, 1, 0.3, 1) approximated
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setDisplayed(`${prefix}${fmt.format(current)}${suffix}`);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Only trigger once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return displayed;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
  trend,
  gradient = false,
  animate = false,
  interactive = true,
  className,
}: StatCardProps) {
  const displayed = useCountUp(animate, value);
  const trendPositive = trend && trend.value >= 0;
  const [hasAnimated, setHasAnimated] = useState(false);
  useEffect(() => {
    if (animate) setHasAnimated(true);
  }, [animate]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]",
        interactive && "card-hover cursor-default",
        className,
      )}
    >
      {/* Gradient wash */}
      {gradient && tone !== "default" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br",
            TONE_GRADIENT_BG[tone],
          )}
        />
      )}

      {/* Icon */}
      {Icon && (
        <div
          className={cn(
            "absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg",
            TONE_ICON_BG[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}

      {/* Label */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      {/* Value */}
      <p
        className={cn(
          "mt-2 font-display text-3xl tabular-nums leading-none",
          TONE_VALUE[tone],
          animate && !hasAnimated && "animate-count-up",
          animate && hasAnimated && "opacity-100 translate-y-0", // Ensure visibility after animation
        )}
      >
        {animate ? displayed : value}
      </p>

      {/* Trend badge */}
      {trend !== undefined && (
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              trendPositive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {trendPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trendPositive ? "+" : ""}
            {trend.value.toFixed(1)}%
            {trend.label && <span className="ml-1 opacity-70">{trend.label}</span>}
          </span>
        </div>
      )}

      {/* Sub */}
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
