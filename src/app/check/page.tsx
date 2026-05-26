import type { Metadata } from "next";
import { CheckSearch } from "@/components/CheckSearch";
import { checksIndex, filters, stats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Checks",
  description: "Browse and search cloud security checks.",
};

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ providers?: string; severities?: string; q?: string }>;
}) {
  const { providers = "", severities = "", q = "" } = await searchParams;
  const providerOptions = filters.providers.map((p) => p.providerId);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Security checks</h1>
      <p className="mt-1 text-muted">
        {stats.checkVariants.toLocaleString()} checks across {providerOptions.length} providers.
      </p>
      <div className="mt-6">
        <CheckSearch
          initial={checksIndex}
          providers={providerOptions}
          initialProvider={providers.split(",")[0] || ""}
          initialSeverity={severities.split(",")[0] || ""}
          initialTerm={q}
          autoFocus
        />
      </div>
    </div>
  );
}
