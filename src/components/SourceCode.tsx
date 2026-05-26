"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";

// Providers whose checks are generated at runtime (Checkov/Trivy/LLM) and have
// no per-check source file in the prowler repo.
const NON_REPO = new Set(["iac", "llm", "image"]);

const RAW = "https://raw.githubusercontent.com/prowler-cloud/prowler/master/prowler/providers";
const BLOB = "https://github.com/prowler-cloud/prowler/blob/master/prowler/providers";

type Tab = "source" | "fixer";

export function SourceCode({
  provider,
  service,
  id,
  fixer,
}: {
  provider: string;
  service: string;
  id: string;
  fixer: boolean;
}) {
  const supported = !NON_REPO.has(provider) && !!service;
  const dir = `${provider}/services/${service}/${id}`;
  const rawDir = `${RAW}/${dir}`;
  const blobDir = `${BLOB}/${dir}`;

  const [tab, setTab] = useState<Tab>("source");
  const [code, setCode] = useState<Record<Tab, string | null>>({ source: null, fixer: null });
  const [state, setState] = useState<"loading" | "ok" | "error">(supported ? "loading" : "error");

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    (async () => {
      try {
        const jobs: Promise<void>[] = [
          fetch(`${rawDir}/${id}.py`)
            .then((r) => (r.ok ? r.text() : Promise.reject()))
            .then((t) => { if (alive) setCode((c) => ({ ...c, source: t })); }),
        ];
        if (fixer) {
          jobs.push(
            fetch(`${rawDir}/${id}_fixer.py`)
              .then((r) => (r.ok ? r.text() : Promise.reject()))
              .then((t) => { if (alive) setCode((c) => ({ ...c, fixer: t })); })
              .catch(() => {})
          );
        }
        await jobs[0];
        if (alive) setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; };
  }, [supported, rawDir, id, fixer]);

  const tabs: { key: Tab; label: string; file: string }[] = [
    { key: "source", label: "Check code", file: `${id}.py` },
    ...(fixer ? [{ key: "fixer" as Tab, label: "Fixer", file: `${id}_fixer.py` }] : []),
  ];
  const current = code[tab];

  if (!supported) {
    return (
      <p className="text-sm text-muted">
        This check is generated at runtime ({provider}); it has no dedicated source file in the Prowler repository.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-2">
        <div className="flex flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-3 py-2.5 text-sm transition ${tab === t.key ? "text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {t.label}
              {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-1">
          {current && <CopyButton text={current} label="" />}
          <a
            href={`${blobDir}/${tabs.find((t) => t.key === tab)?.file}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.8c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z"/></svg>
            GitHub
          </a>
        </div>
      </div>
      {state === "loading" && (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-surface-2" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
          ))}
        </div>
      )}
      {state === "error" && (
        <div className="p-4 text-sm text-muted">
          Couldn’t load the source.{" "}
          <a href={`${blobDir}/${id}.py`} target="_blank" rel="noreferrer" className="text-accent hover:underline">View on GitHub →</a>
        </div>
      )}
      {state === "ok" && current === null && <div className="p-4 text-sm text-muted">Not available.</div>}
      {state === "ok" && current !== null && <pre className="code !rounded-none !border-0">{current}</pre>}
    </div>
  );
}
