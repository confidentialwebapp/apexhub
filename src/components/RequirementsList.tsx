"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Requirement } from "@/lib/types";

const PAGE = 100;

export function RequirementsList({ requirements }: { requirements: Requirement[] }) {
  const [term, setTerm] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return requirements;
    return requirements.filter(
      (r) =>
        (r.id || "").toLowerCase().includes(t) ||
        (r.name || "").toLowerCase().includes(t) ||
        (r.description || "").toLowerCase().includes(t) ||
        (r.checks || []).some((c) => c.toLowerCase().includes(t))
    );
  }, [requirements, term]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-1 mb-4 bg-background/80 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Filter requirements — id, name, or check…"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
          />
          <span className="shrink-0 text-xs text-muted">{filtered.length} shown</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {shown.map((r, i) => {
          const checks = r.checks ?? [];
          return (
            <details key={`${r.id}-${i}`} className="group rounded-xl border border-border bg-surface transition hover:border-accent/40">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-muted transition group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">{r.id}</span>
                    {r.name && <span className="font-medium">{r.name}</span>}
                  </div>
                  {r.description && !r.name && (
                    <p className="mt-1 line-clamp-1 text-sm text-muted group-open:hidden">{r.description}</p>
                  )}
                </div>
                {checks.length > 0 && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{checks.length}</span>
                )}
              </summary>
              <div className="border-t border-border px-4 py-3 pl-11">
                {r.description && <p className="whitespace-pre-line text-sm text-foreground/85">{r.description}</p>}
                {checks.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Checks</div>
                    <div className="flex flex-wrap gap-1.5">
                      {checks.map((c) => (
                        <Link key={c} href={`/check/${encodeURIComponent(c)}`}
                          className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs transition hover:border-accent/60 hover:text-accent">
                          {c}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {limit < filtered.length && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-5 w-full rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-muted transition hover:border-accent/50 hover:text-foreground"
        >
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
