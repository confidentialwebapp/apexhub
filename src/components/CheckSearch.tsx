"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SeverityBadge, ProviderBadge } from "./badges";
import type { CheckIndexItem } from "@/lib/types";

export function CheckSearch({
  initial = [],
  providers = [],
  autoFocus = false,
  initialProvider = "",
  initialSeverity = "",
}: {
  initial?: CheckIndexItem[];
  providers?: string[];
  autoFocus?: boolean;
  initialProvider?: string;
  initialSeverity?: string;
}) {
  const [term, setTerm] = useState("");
  const [provider, setProvider] = useState(initialProvider);
  const [severity, setSeverity] = useState(initialSeverity);
  const [results, setResults] = useState<CheckIndexItem[]>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/check/search?term=${encodeURIComponent(term)}&limit=500`);
        const data: CheckIndexItem[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term]);

  const filtered = useMemo(() => {
    return results.filter(
      (c) => (!provider || c.provider === provider) && (!severity || c.severity === severity)
    );
  }, [results, provider, severity]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          autoFocus={autoFocus}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search checks — e.g. s3 public, mfa, encryption…"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="">All severities</option>
          {["critical", "high", "medium", "low", "informational"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-xs text-muted">
        {loading ? "Searching…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
      </p>

      <ul className="mt-3 space-y-2">
        {filtered.slice(0, 300).map((c) => (
          <li key={c.key}>
            <Link
              href={`/check/${encodeURIComponent(c.key)}`}
              className="block rounded-lg border border-border bg-surface p-4 transition hover:border-accent/60 hover:bg-surface-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={c.severity} />
                <ProviderBadge provider={c.provider} />
                <span className="text-xs text-muted">{c.service}</span>
              </div>
              <h3 className="mt-2 font-medium">{c.title}</h3>
              <p className="mt-0.5 font-mono text-xs text-muted">{c.id}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
