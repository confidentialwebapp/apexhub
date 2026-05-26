"use client";

import { useState } from "react";
import type { Remediation } from "@/lib/types";

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

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {available.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-1.5 text-sm transition ${
              active === t.key ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="code mt-3">{clean(current?.description || "")}</pre>
    </div>
  );
}
