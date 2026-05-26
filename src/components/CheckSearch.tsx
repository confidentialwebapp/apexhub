"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SeverityBadge, ProviderBadge } from "./badges";
import type { CheckIndexItem, CheckFilters } from "@/lib/types";

const PAGE_SIZE = 60;
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

export function CheckSearch({
  initial = [],
  facets,
  initialProvider = "",
  initialSeverity = "",
  initialTerm = "",
}: {
  initial?: CheckIndexItem[];
  facets: CheckFilters;
  initialProvider?: string;
  initialSeverity?: string;
  initialTerm?: string;
}) {
  const [term, setTerm] = useState(initialTerm);
  const [provider, setProvider] = useState(initialProvider);
  const [severity, setSeverity] = useState(initialSeverity);
  const [service, setService] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [compliance, setCompliance] = useState("");
  const [page, setPage] = useState(1);

  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const out = initial.filter((c) => {
      if (provider && c.provider !== provider) return false;
      if (severity && c.severity !== severity) return false;
      if (service && c.service !== service) return false;
      if (category && !(c.categories ?? []).includes(category)) return false;
      if (type && !(c.type ?? []).includes(type)) return false;
      if (compliance && !(c.compliances ?? []).includes(compliance)) return false;
      if (t) {
        const hay = `${c.id} ${c.title} ${c.description} ${c.provider} ${c.service} ${(c.categories ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const sr = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9);
      if (sr !== 0) return sr;
      return a.id.localeCompare(b.id);
    });
    return out;
  }, [initial, term, provider, severity, service, category, type, compliance]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const start = total === 0 ? 0 : (curPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const anyFilter = provider || severity || service || category || type || compliance || term;
  function clearAll() {
    setTerm(""); setProvider(""); setSeverity(""); setService(""); setCategory(""); setType(""); setCompliance(""); setPage(1);
  }

  return (
    <div>
      {/* search + filters */}
      <input
        value={term}
        onChange={(e) => reset(setTerm)(e.target.value)}
        placeholder="Search checks — e.g. “s3 public access”, “mfa”, “encryption”…"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
      />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Facet label="Provider" value={provider} onChange={reset(setProvider)}
          options={facets.providers.map((p) => ({ value: p.providerId, label: `${p.name} (${p.count})` }))} />
        <Facet label="Severity" value={severity} onChange={reset(setSeverity)}
          options={facets.severities.map((s) => ({ value: s.severity, label: `${s.severity} (${s.count})` }))} />
        <Facet label="Service" value={service} onChange={reset(setService)}
          options={facets.services.map((s) => ({ value: s.service, label: `${s.service} (${s.count})` }))} />
        <Facet label="Category" value={category} onChange={reset(setCategory)}
          options={facets.categories.map((c) => ({ value: c.category, label: `${c.category} (${c.count})` }))} />
        <Facet label="Type" value={type} onChange={reset(setType)}
          options={facets.types.map((t) => ({ value: t.type, label: `${t.type} (${t.count})` }))} />
        <Facet label="Compliance" value={compliance} onChange={reset(setCompliance)}
          options={facets.compliances.map((c) => ({ value: c.id, label: `${c.framework}${c.version ? " " + c.version : ""} · ${c.provider} (${c.count})` }))} />
      </div>

      {/* counter */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {total === 0 ? "0 results" : <>Showing <span className="text-foreground">{start + 1}–{start + slice.length}</span> of <span className="text-foreground">{total.toLocaleString()}</span> results</>}
        </span>
        {anyFilter && (
          <button onClick={clearAll} className="rounded-md border border-border px-2.5 py-1 text-xs transition hover:border-accent/50 hover:text-foreground">
            Clear filters
          </button>
        )}
      </div>

      {/* results */}
      <ul className="mt-3 space-y-2">
        {slice.map((c) => (
          <li key={`${c.provider}.${c.id}`}>
            <Link href={`/check/${encodeURIComponent(c.id)}`}
              className="block rounded-lg border border-border bg-surface p-4 transition hover:border-accent/60 hover:bg-surface-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={c.severity} />
                <ProviderBadge provider={c.provider} />
                <span className="text-xs text-muted">{c.service}</span>
                {c.fixer && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">fixer</span>
                )}
              </div>
              <h3 className="mt-2 font-medium">{c.title}</h3>
              <p className="mt-0.5 break-all font-mono text-xs text-muted">{c.id}</p>
            </Link>
          </li>
        ))}
      </ul>

      {/* pagination */}
      {pages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <PageBtn disabled={curPage <= 1} onClick={() => setPage(1)}>« First</PageBtn>
          <PageBtn disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹ Prev</PageBtn>
          <span className="px-2 text-muted">Page {curPage} / {pages}</span>
          <PageBtn disabled={curPage >= pages} onClick={() => setPage(curPage + 1)}>Next ›</PageBtn>
          <PageBtn disabled={curPage >= pages} onClick={() => setPage(pages)}>Last »</PageBtn>
        </div>
      )}
    </div>
  );
}

function Facet({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border bg-surface px-2.5 py-2 text-sm outline-none transition focus:border-accent ${value ? "border-accent/60 text-foreground" : "border-border text-muted"}`}
    >
      <option value="">{label} (all)</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-border bg-surface px-3 py-1.5 transition enabled:hover:border-accent/50 enabled:hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}
