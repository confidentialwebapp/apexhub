const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  informational: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || "informational").toLowerCase();
  const cls = SEVERITY_STYLES[s] ?? SEVERITY_STYLES.informational;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {s}
    </span>
  );
}

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted">
      {provider}
    </span>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}
