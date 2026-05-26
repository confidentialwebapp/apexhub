import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { complianceIndex, getCompliance } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { CopyButton } from "@/components/CopyButton";
import { RequirementsList } from "@/components/RequirementsList";

export const dynamicParams = false;

export function generateStaticParams() {
  return complianceIndex.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await getCompliance(decodeURIComponent(id));
  if (!c) return { title: "Framework not found" };
  return { title: c.name, description: (c.description ?? "").slice(0, 150) };
}

export default async function ComplianceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompliance(decodeURIComponent(id));
  if (!c) notFound();
  const requirements = c.requirements ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/compliance" className="hover:text-foreground">Compliance</Link>
        <span>/</span>
        <span className="truncate font-mono text-foreground/70">{c.id}</span>
      </nav>

      {/* header card */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2 p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">{c.framework}</span>
            <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs uppercase text-muted">{c.provider}</span>
            {c.version && <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted">v{c.version}</span>}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{c.name}</h1>

          <div className="mt-5 flex flex-wrap gap-3">
            <Metric value={c.total_requirements} label="Requirements" />
            <Metric value={c.total_checks} label="Checks" />
            <Metric value={c.provider} label="Provider" />
          </div>
        </div>
      </div>

      {c.description && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <Markdown>{c.description}</Markdown>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Requirements</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>API</span>
          <CopyButton text={`/api/compliance/${c.id}`} label="" />
        </div>
      </div>
      <div className="mt-4">
        <RequirementsList requirements={requirements} />
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 px-4 py-2.5">
      <div className="text-xl font-bold tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
