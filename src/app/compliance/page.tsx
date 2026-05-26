import type { Metadata } from "next";
import { ComplianceSearch } from "@/components/ComplianceSearch";
import { complianceIndex } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compliance frameworks",
  description: "Browse cloud security compliance frameworks and their requirements.",
};

export default function CompliancePage() {
  const providers = [...new Set(complianceIndex.map((c) => c.provider))].filter(Boolean).sort();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Compliance frameworks</h1>
      <p className="mt-1 text-muted">{complianceIndex.length} frameworks mapped to security checks.</p>
      <div className="mt-6">
        <ComplianceSearch initial={complianceIndex} providers={providers} />
      </div>
    </div>
  );
}
