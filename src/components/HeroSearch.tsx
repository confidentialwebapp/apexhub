"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTIONS = ["s3 public", "mfa", "encryption", "public ip", "logging", "root account"];

export function HeroSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function go(q: string) {
    const t = q.trim();
    router.push(t ? `/check?q=${encodeURIComponent(t)}` : "/check");
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(term);
        }}
        className="group flex items-center gap-2 rounded-xl border border-border bg-surface/70 p-1.5 pl-4 backdrop-blur transition focus-within:border-accent/70 focus-within:shadow-[0_0_0_4px_rgba(91,140,255,0.12)]"
      >
        <svg className="h-5 w-5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search 1,974 checks — e.g. “s3 public access”, “mfa”, “encryption”…"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70"
          aria-label="Search checks"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Search
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Popular:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => go(s)}
            className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted transition hover:border-accent/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
