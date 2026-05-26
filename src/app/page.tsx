import Link from "next/link";
import { stats, complianceIndex, filters } from "@/lib/data";

const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  m365: "Microsoft 365",
  kubernetes: "Kubernetes",
  github: "GitHub",
  googleworkspace: "Google Workspace",
};

export default function Home() {
  const topProviders = filters.providers;
  const featured = complianceIndex
    .filter((c) => /cis|nist|pci|iso|soc|gdpr|hipaa/i.test(c.framework))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="py-14 sm:py-20">
        <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          {stats.checkVariants.toLocaleString()} checks · {stats.compliance} frameworks · {topProviders.length} providers
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          The hub for cloud security{" "}
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">checks &amp; compliance</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Search detection and remediation checks across AWS, Azure, GCP, Kubernetes, M365 and more — and explore the
          compliance frameworks they map to. Backed by a JSON API.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/check" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90">Browse checks</Link>
          <Link href="/compliance" className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:bg-surface-2">Compliance frameworks</Link>
          <Link href="/api/docs" className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:bg-surface-2">API docs</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Checks" value={stats.checkVariants.toLocaleString()} />
        <Stat label="Frameworks" value={String(stats.compliance)} />
        <Stat label="Services" value={String(stats.serviceCount)} />
        <Stat label="Categories" value={String(stats.categoryCount)} />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Checks by provider</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {topProviders.map((p) => (
            <Link
              key={p.providerId}
              href={`/check?providers=${p.providerId}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-accent/60 hover:bg-surface-2"
            >
              <span className="font-medium capitalize">{PROVIDER_LABELS[p.providerId] ?? p.name}</span>
              <span className="text-sm text-muted">{p.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Popular compliance frameworks</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {featured.map((f) => (
            <Link
              key={f.id}
              href={`/compliance/${encodeURIComponent(f.id)}`}
              className="rounded-lg border border-border bg-surface p-4 transition hover:border-accent/60 hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{f.framework}</span>
                <span className="text-xs uppercase text-muted">{f.provider}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{f.name}</p>
              <p className="mt-2 text-xs text-muted">{f.total_requirements} requirements</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}
