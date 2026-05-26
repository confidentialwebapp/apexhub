"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ComplianceIndexItem } from "@/lib/types";

export function ComplianceSearch({
  initial = [],
  providers = [],
}: {
  initial?: ComplianceIndexItem[];
  providers?: string[];
}) {
  const [term, setTerm] = useState("");
  const [provider, setProvider] = useState("");
  const [results, setResults] = useState<ComplianceIndexItem[]>(initial);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/compliance/search?term=${encodeURIComponent(term)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term]);

  const filtered = useMemo(
    () => results.filter((c) => !provider || c.provider === provider),
    [results, provider]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search frameworks — e.g. CIS, NIST, PCI, ISO 27001…"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
        />
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent">
          <option value="">All providers</option>
          {providers.map((p) => (<option key={p} value={p}>{p}</option>))}
        </select>
      </div>

      <p className="mt-3 text-xs text-muted">{filtered.length} frameworks</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/compliance/${encodeURIComponent(c.id)}`}
            className="rounded-lg border border-border bg-surface p-4 transition hover:border-accent/60 hover:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.framework}</span>
              <span className="text-xs uppercase text-muted">{c.provider}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{c.name}</p>
            <p className="mt-2 text-xs text-muted">
              {c.total_requirements} requirements · {c.total_checks} checks
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
