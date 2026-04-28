import React, { useEffect, useRef, useState } from "react";

type Tone = "default" | "success" | "destructive" | "warning";

const TONE_GRADIENT: Record<Tone, string> = {
  default: "",
  success: "bg-gradient-to-br from-success/8 via-transparent to-transparent",
  destructive: "bg-gradient-to-br from-destructive/8 via-transparent to-transparent",
  warning: "bg-gradient-to-br from-warning/8 via-transparent to-transparent",
};

const TONE_VALUE: Record<Tone, string> = {
  default: "",
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning-foreground",
};

function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

export function StatCard({
  label,
  value,
  rawValue,
  sub,
  tone = "default",
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  /** Optional numeric value to drive count-up animation */
  rawValue?: number;
  sub?: React.ReactNode;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  delta?: { value: number; label?: string };
}) {
  const animated = useCountUp(rawValue ?? 0, 600);

  // Format animated value to match the value format when rawValue is provided
  const displayValue =
    rawValue !== undefined
      ? value.replace(/[\d\s]+(?:[,.][\d]+)?/, () =>
          Math.round(animated).toLocaleString("pl-PL")
        )
      : value;

  return (
    <div
      className={`relative bg-card rounded-[1.25rem] p-5 border border-border shadow-[var(--shadow-warm)] overflow-hidden transition-shadow hover:shadow-[var(--shadow-warm),0_0_0_2px_var(--color-border)] ${TONE_GRADIENT[tone]}`}
    >
      {/* Ghost icon */}
      {Icon && (
        <div className="absolute top-3 right-3 opacity-[0.12] pointer-events-none">
          <Icon className="w-10 h-10" />
        </div>
      )}

      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold leading-none mb-2">
        {label}
      </p>

      <p className={`font-display text-3xl tabular-nums leading-none ${TONE_VALUE[tone]}`}>
        {rawValue !== undefined ? displayValue : value}
      </p>

      {(sub || delta) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex-1">{sub}</div>
          {delta && (
            <span
              className={`shrink-0 font-semibold tabular-nums px-1.5 py-0.5 rounded-full text-[10px] ${
                delta.value >= 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {delta.value >= 0 ? "+" : ""}
              {delta.value.toFixed(0)}%{delta.label ? ` ${delta.label}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
