"use client";

import { useState } from "react";
import type { CheckRemediation } from "@/lib/types";

const TABS: { key: keyof CheckRemediation; label: string }[] = [
  { key: "cli", label: "CLI" },
  { key: "terraform", label: "Terraform" },
  { key: "nativeIaC", label: "Native IaC" },
  { key: "other", label: "Console / Other" },
];

// Strip surrounding ```lang fences that exist in some entries so <pre> doesn't double-render them.
function clean(v: string) {
  return v.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
}

export function RemediationTabs({ remediation }: { remediation: CheckRemediation }) {
  const available = TABS.filter((t) => (remediation[t.key] || "").trim().length > 0);
  const [active, setActive] = useState(available[0]?.key ?? "cli");

  if (available.length === 0) {
    return <p className="text-sm text-muted">No remediation code provided.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {available.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-1.5 text-sm transition ${
              active === t.key
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="code mt-3">{clean(remediation[active] as string)}</pre>
    </div>
  );
}
