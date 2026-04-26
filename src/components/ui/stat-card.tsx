export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning-foreground"
          : "";

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`font-display text-3xl mt-1.5 tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
