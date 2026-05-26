import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { checksIndex, getCheck } from "@/lib/data";
import { SeverityBadge, ProviderBadge, Pill } from "@/components/badges";
import { Markdown } from "@/components/Markdown";
import { RemediationTabs } from "@/components/RemediationTabs";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(checksIndex.map((c) => c.id))].map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const check = await getCheck(decodeURIComponent(id));
  if (!check) return { title: "Check not found" };
  return { title: check.title, description: check.description.slice(0, 150) };
}

export default async function CheckDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await getCheck(decodeURIComponent(id));
  if (!check) notFound();

  const refs = [check.related_url, ...check.additional_urls].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/check" className="text-sm text-accent hover:underline">← All checks</Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={check.severity} />
        <ProviderBadge provider={check.provider} />
        {check.service && <Pill>{check.service}</Pill>}
        {check.resource_type && <Pill>{check.resource_type}</Pill>}
        {check.fixer && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
            fixer available
          </span>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">{check.title}</h1>
      <p className="mt-1 font-mono text-sm text-muted">{check.id}</p>

      <Section title="Description"><Markdown>{check.description}</Markdown></Section>

      {check.risk && <Section title="Risk"><Markdown>{check.risk}</Markdown></Section>}

      <Section title="Remediation">
        {check.remediation.wui.description && (
          <div className="mb-4"><Markdown>{check.remediation.wui.description}</Markdown></div>
        )}
        <RemediationTabs remediation={check.remediation} />
      </Section>

      {check.categories.length > 0 && (
        <Section title="Categories">
          <div className="flex flex-wrap gap-2">{check.categories.map((c) => <Pill key={c}>{c}</Pill>)}</div>
        </Section>
      )}

      {check.compliances.length > 0 && (
        <Section title={`Compliance (${check.compliances.length})`}>
          <div className="flex flex-wrap gap-2">
            {check.compliances.map((f) => (
              <Link
                key={f.id}
                href={`/compliance/${encodeURIComponent(f.id)}`}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs transition hover:border-accent/60 hover:bg-surface-2"
              >
                {f.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {refs.length > 0 && (
        <Section title="References">
          <ul className="space-y-1 text-sm">
            {refs.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">{u}</a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-10 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        API: <a className="font-mono text-accent hover:underline" href={`/api/check/${encodeURIComponent(check.id)}`}>/api/check/{check.id}</a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}
