"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SeverityBadge, ProviderBadge } from "./badges";

interface Cotd {
  date: string;
  check: {
    id: string;
    title: string;
    description: string;
    provider: string;
    service: string;
    severity: string;
    fixer: boolean;
  };
}

export function CheckOfTheDay() {
  const [data, setData] = useState<Cotd | null>(null);

  useEffect(() => {
    fetch("/api/check-of-the-day/today")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Check of the day
      </div>
      {!data ? (
        <div className="mt-4 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        </div>
      ) : (
        <Link href={`/check/${data.check.id}`} className="group mt-4 block">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={data.check.severity} />
            <ProviderBadge provider={data.check.provider} />
            <span className="text-xs text-muted">{data.check.service}</span>
            {data.check.fixer && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">fixer</span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug transition group-hover:text-accent">{data.check.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted">{data.check.description}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
            View check
            <svg className="h-4 w-4 transition group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>
      )}
    </div>
  );
}
