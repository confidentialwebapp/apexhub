import type { Metadata } from "next";
import { CheckSearch } from "@/components/CheckSearch";
import { checksIndex, stats } from "@/lib/data";

export const metadata: Metadata = {
  title: "Checks",
  description: "Browse and search cloud security checks.",
};

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; severity?: string }>;
}) {
  const { provider = "", severity = "" } = await searchParams;
  const providers = Object.keys(stats.providers).sort();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Security checks</h1>
      <p className="mt-1 text-muted">
        {stats.checks.toLocaleString()} checks across {providers.length} providers.
      </p>
      <div className="mt-6">
        <CheckSearch
          initial={checksIndex}
          providers={providers}
          initialProvider={provider}
          initialSeverity={severity}
          autoFocus
        />
      </div>
    </div>
  );
}
