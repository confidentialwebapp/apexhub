"use client";

import { useState } from "react";
import type { Remediation } from "@/lib/types";
import { CopyButton } from "./CopyButton";

const TABS: { key: keyof Remediation; label: string }[] = [
  { key: "cli", label: "CLI" },
  { key: "terraform", label: "Terraform" },
  { key: "nativeiac", label: "Native IaC" },
  { key: "other", label: "Console / Other" },
];

// Strip surrounding ```lang fences present in some entries.
function clean(v: string) {
  return v.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
}

export function RemediationTabs({ remediation }: { remediation: Remediation }) {
  const available = TABS.filter((t) => {
    const item = remediation[t.key] as { description?: string };
    return (item?.description || "").trim().length > 0;
  });
  const [active, setActive] = useState<keyof Remediation>(available[0]?.key ?? "cli");

  if (available.length === 0) return <p className="text-sm text-muted">No remediation code provided.</p>;

  const current = remediation[active] as { description?: string };
  const code = clean(current?.description || "");

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-2">
        <div className="flex flex-wrap">
          {available.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`relative px-3 py-2.5 text-sm transition ${
                active === t.key ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {active === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <CopyButton text={code} className="mr-1 shrink-0" />
      </div>
      <pre className="code !rounded-none !border-0">{code}</pre>
    </div>
  );
}
