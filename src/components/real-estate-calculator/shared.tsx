import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatLocaleAmount, parseLocaleAmount } from "@/lib/salary";

export function NumField({
  label,
  value,
  onChange,
  hint,
  feedback,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
  feedback?: React.ReactNode;
}) {
  const [localValue, setLocalValue] = useState<string>(formatLocaleAmount(value));

  useEffect(() => {
    const parsedLocal = parseLocaleAmount(localValue);
    if (parsedLocal !== value) {
      setLocalValue(formatLocaleAmount(value));
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5 group">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            {label}
          </label>
          {hint && <span className="text-[10px] text-muted-foreground italic mt-0.5 block leading-tight">{hint}</span>}
        </div>
        <Input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(parseLocaleAmount(e.target.value));
          }}
          onBlur={() => setLocalValue(formatLocaleAmount(value))}
          className="h-9 font-mono tabular-nums text-right bg-muted/10 border-border focus:bg-background w-32 transition-colors group-hover:bg-muted/30 text-sm"
        />
      </div>
      {feedback && (
        <div className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-1 rounded-md ml-auto w-fit flex items-center gap-1.5">
          {feedback}
        </div>
      )}
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  feedback,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  feedback?: React.ReactNode;
}) {
  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </label>
        <span className="font-mono tabular-nums text-xs bg-muted/40 px-2 py-1 rounded-md">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        className="py-2 cursor-pointer"
      />
      {feedback && (
        <div className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-1 rounded-md flex items-center gap-1.5 w-fit ml-auto">
          {feedback}
        </div>
      )}
    </div>
  );
}
