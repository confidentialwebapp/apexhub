import Link from "next/link";
import { stats, complianceIndex, filters } from "@/lib/data";
import { HeroSearch } from "@/components/HeroSearch";
import { CheckOfTheDay } from "@/components/CheckOfTheDay";

const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  m365: "Microsoft 365",
  kubernetes: "Kubernetes",
  github: "GitHub",
  googleworkspace: "Google Workspace",
  iac: "IaC",
  llm: "LLM",
  image: "Container Image",
};

export default function Home() {
  const providers = filters.providers;
  const featured = complianceIndex
    .filter((c) => /cis|nist|pci|iso|soc|gdpr|hipaa|fedramp/i.test(c.framework))
    .slice(0, 8);
  const artifacts = stats.n_artifacts.toLocaleString();

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_-10%,rgba(91,140,255,0.18),transparent)]" />
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(40rem_30rem_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {artifacts} artifacts · {stats.checkVariants.toLocaleString()} checks · {stats.compliance} frameworks
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Cloud security{" "}
              <span className="bg-gradient-to-r from-accent via-accent-2 to-accent bg-clip-text text-transparent">
                checks &amp; compliance
              </span>
              , in one hub.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
              Browse detection &amp; remediation checks across AWS, Azure, GCP, Kubernetes, IaC, M365 and
              more — and the compliance frameworks they map to. Fully searchable, backed by a JSON API.
            </p>
            <div className="mt-7">
              <HeroSearch />
            </div>
          </div>
          <div className="lg:pl-4">
            <CheckOfTheDay />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5">
        {/* ---------- STAT BAND ---------- */}
        <section className="-mt-px grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
          <Stat label="Artifacts" value={artifacts} />
          <Stat label="Checks" value={stats.checkVariants.toLocaleString()} />
          <Stat label="Frameworks" value={String(stats.compliance)} />
          <Stat label="Providers" value={String(providers.length)} />
          <Stat label="Services" value={String(stats.serviceCount)} />
        </section>

        {/* ---------- BROWSE CARDS ---------- */}
        <section className="mt-14 grid gap-5 md:grid-cols-2">
          <BrowseCard
            href="/check"
            eyebrow="Detection & Remediation"
            title="Browse security checks"
            desc={`${stats.checkVariants.toLocaleString()} checks with severity, risk, remediation code (CLI, Terraform, IaC) and compliance mappings.`}
            accent="from-accent/20"
            icon={
              <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
            }
          />
          <BrowseCard
            href="/compliance"
            eyebrow="Frameworks"
            title="Browse compliance frameworks"
            desc={`${stats.compliance} frameworks — CIS, NIST, PCI-DSS, ISO 27001, SOC 2, FedRAMP and more — mapped to checks.`}
            accent="from-accent-2/20"
            icon={
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            }
          />
        </section>

        {/* ---------- PROVIDERS ---------- */}
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Checks by provider</h2>
            <Link href="/check" className="text-sm text-accent hover:underline">View all →</Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {providers.map((p) => (
              <Link
                key={p.providerId}
                href={`/check?providers=${p.providerId}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-2"
              >
                <span className="font-medium">{PROVIDER_LABELS[p.providerId] ?? p.name}</span>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted transition group-hover:bg-accent/15 group-hover:text-accent">
                  {p.count}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- POPULAR FRAMEWORKS ---------- */}
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Popular compliance frameworks</h2>
            <Link href="/compliance" className="text-sm text-accent hover:underline">View all →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((f) => (
              <Link
                key={f.id}
                href={`/compliance/${encodeURIComponent(f.id)}`}
                className="group rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{f.framework}</span>
                  <span className="text-xs uppercase text-muted">{f.provider}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{f.name}</p>
                <p className="mt-3 text-xs text-muted">{f.total_requirements} requirements · {f.total_checks} checks</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- API CALLOUT ---------- */}
        <section className="my-16 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">A JSON API for everything</h2>
              <p className="mt-2 text-muted">
                Every check and framework is available programmatically. Filter, search, and pull full
                metadata — documented with OpenAPI.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/api/docs" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition hover:opacity-90">
                  API documentation
                </Link>
                <a href="/apispec_v1.yaml" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-surface-2">
                  OpenAPI spec
                </a>
              </div>
            </div>
            <pre className="code text-xs leading-relaxed">{`# Search checks
curl -s "/api/check/search?term=s3+public"

# Get one check
curl -s "/api/check/s3_bucket_public_access"

# Filter by provider + severity
curl -s "/api/check?providers=aws&severities=critical"

# Compliance framework with requirements
curl -s "/api/compliance/cis_3.0_aws"`}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-5 text-center sm:text-left">
      <div className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function BrowseCard({
  href,
  eyebrow,
  title,
  desc,
  icon,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${accent} to-transparent blur-2xl`} />
      <div className="relative">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-2 text-accent">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold transition group-hover:text-accent">{title}</h3>
        <p className="mt-2 text-sm text-muted">{desc}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
          Explore
          <svg className="h-4 w-4 transition group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
