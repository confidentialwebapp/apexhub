import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { checksIndex, getCheck } from "@/lib/data";
import { SeverityBadge, ProviderBadge, Pill, SEVERITY_ACCENT } from "@/components/badges";
import { Markdown } from "@/components/Markdown";
import { RemediationTabs } from "@/components/RemediationTabs";
import { SourceCode } from "@/components/SourceCode";
import { CopyButton } from "@/components/CopyButton";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(checksIndex.map((c) => c.id))].map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const check = await getCheck(decodeURIComponent(id));
  if (!check) return { title: "Check not found" };
  return { title: check.title, description: (check.description ?? "").slice(0, 150) };
}

export default async function CheckDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await getCheck(decodeURIComponent(id));
  if (!check) notFound();

  const categories = check.categories ?? [];
  const compliances = check.compliances ?? [];
  const types = check.type ?? [];
  const dependsOn = check.depends_on ?? [];
  const relatedTo = check.related_to ?? [];
  const referenceArr = Array.isArray(check.reference) ? check.reference : [];
  const refs = [...new Set([check.related_url, ...(check.additional_urls ?? []), ...referenceArr].filter(Boolean))] as string[];
  const accent = SEVERITY_ACCENT[check.severity] ?? SEVERITY_ACCENT.informational;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/check" className="hover:text-foreground">Checks</Link>
        <span>/</span>
        <span className="truncate font-mono text-foreground/70">{check.id}</span>
      </nav>

      {/* header card */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} />
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={check.severity} />
          <ProviderBadge provider={check.provider} />
          {check.service && <Pill>{check.service}</Pill>}
          {check.resource_type && <Pill>{check.resource_type}</Pill>}
          {check.fixer && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              automated fixer
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{check.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <code className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">{check.id}</code>
          <CopyButton text={check.id} label="Copy ID" />
        </div>
      </div>

      {/* body */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {check.description && <Section title="Description"><Markdown>{check.description}</Markdown></Section>}
          {check.risk && (
            <Section title="Risk">
              <div className="rounded-xl border border-border bg-surface p-4"><Markdown>{check.risk}</Markdown></div>
            </Section>
          )}
          <Section title="Remediation">
            {check.remediation?.wui?.description && (
              <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Recommendation</div>
                <Markdown>{check.remediation.wui.description}</Markdown>
              </div>
            )}
            {check.remediation && <RemediationTabs remediation={check.remediation} />}
          </Section>
          <Section title="Source code">
            <SourceCode provider={check.provider} service={check.service} id={check.id} fixer={check.fixer} />
          </Section>
          {refs.length > 0 && (
            <Section title="References">
              <ul className="space-y-2">
                {refs.map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer" className="group flex items-start gap-2 text-sm text-accent hover:underline">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="break-all">{u}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Details">
            <dl className="space-y-2.5 text-sm">
              <Row k="Provider" v={check.provider} />
              <Row k="Service" v={check.service || "—"} />
              {check.subservice && <Row k="Subservice" v={check.subservice} />}
              <Row k="Resource type" v={check.resource_type ? <code className="font-mono text-xs">{check.resource_type}</code> : "—"} />
              <Row k="Severity" v={<span className="capitalize">{check.severity}</span>} />
              <Row k="Fixer" v={check.fixer ? "Available" : "—"} />
            </dl>
            {types.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Type</div>
                <div className="flex flex-wrap gap-1.5">{types.map((t) => <Pill key={t}>{t.split("/").pop()}</Pill>)}</div>
              </div>
            )}
            {categories.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Categories</div>
                <div className="flex flex-wrap gap-1.5">{categories.map((c) => <Pill key={c}>{c}</Pill>)}</div>
              </div>
            )}
          </Card>

          {compliances.length > 0 && (
            <Card title={`Compliance · ${compliances.length}`}>
              <div className="flex flex-wrap gap-1.5">
                {compliances.map((f) => (
                  <Link key={f.id} href={`/compliance/${encodeURIComponent(f.id)}`}
                    className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs transition hover:border-accent/60 hover:text-accent">
                    {f.name}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {(dependsOn.length > 0 || relatedTo.length > 0) && (
            <Card title="Related">
              {dependsOn.length > 0 && <RelList label="Depends on" ids={dependsOn} />}
              {relatedTo.length > 0 && <RelList label="Related to" ids={relatedTo} />}
            </Card>
          )}

          <Card title="API">
            <div className="flex items-center justify-between gap-2">
              <a className="truncate font-mono text-xs text-accent hover:underline" href={`/api/check/${encodeURIComponent(check.id)}`}>
                /api/check/{check.id}
              </a>
              <CopyButton text={`/api/check/${check.id}`} label="" className="shrink-0" />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
function RelList({ label, ids }: { label: string; ids: string[] }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <Link key={id} href={`/check/${encodeURIComponent(id)}`} className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs transition hover:border-accent/60 hover:text-accent">
            {id}
          </Link>
        ))}
      </div>
    </div>
  );
}
