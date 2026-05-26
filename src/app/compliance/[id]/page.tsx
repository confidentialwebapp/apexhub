import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { complianceIndex, getCompliance, resolveCheckKey } from "@/lib/data";
import { Markdown } from "@/components/Markdown";
import { Pill } from "@/components/badges";

export const dynamicParams = false;

export function generateStaticParams() {
  return complianceIndex.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await getCompliance(decodeURIComponent(id));
  if (!c) return { title: "Framework not found" };
  return { title: c.name, description: c.description.slice(0, 150) };
}

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompliance(decodeURIComponent(id));
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/compliance" className="text-sm text-accent hover:underline">
        ← All frameworks
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill>{c.provider}</Pill>
        {c.version && <Pill>v{c.version}</Pill>}
        <Pill>{c.requirementsCount} requirements</Pill>
        <Pill>{c.checksCount} checks</Pill>
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">{c.name}</h1>
      <p className="mt-1 text-sm text-muted">{c.framework}</p>

      {c.description && (
        <div className="mt-4">
          <Markdown>{c.description}</Markdown>
        </div>
      )}

      <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Requirements</h2>
      <div className="space-y-3">
        {c.requirements.map((r, i) => (
          <details key={`${r.id}-${i}`} className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer list-none">
              <span className="font-mono text-xs text-accent">{r.id}</span>
              {r.name && <span className="ml-2 font-medium">{r.name}</span>}
              {r.checks.length > 0 && (
                <span className="ml-2 text-xs text-muted">({r.checks.length} checks)</span>
              )}
            </summary>
            {r.description && (
              <p className="mt-3 text-sm text-foreground/90 whitespace-pre-line">{r.description}</p>
            )}
            {r.checks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.checks.map((checkId) => {
                  const key = resolveCheckKey(checkId, c.provider);
                  const cls =
                    "rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs";
                  return key ? (
                    <Link
                      key={checkId}
                      href={`/check/${encodeURIComponent(key)}`}
                      className={`${cls} transition hover:border-accent/60 hover:text-accent`}
                    >
                      {checkId}
                    </Link>
                  ) : (
                    <span key={checkId} className={`${cls} text-muted`}>
                      {checkId}
                    </span>
                  );
                })}
              </div>
            )}
          </details>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        API:{" "}
        <a className="font-mono text-accent hover:underline" href={`/api/compliance/${encodeURIComponent(c.id)}`}>
          /api/compliance/{c.id}
        </a>
      </div>
    </div>
  );
}
