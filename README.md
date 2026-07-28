# APEX Hub

A browsable hub for **cloud security checks** and **compliance frameworks**, with a JSON API and interactive OpenAPI docs. Built with Next.js (App Router, TypeScript) and deployed on Vercel.

- **2,109 checks** across AWS, Azure, GCP, Kubernetes, IaC, M365, GitLab, Snowflake, Databricks, Salesforce, Okta and more
- **120 compliance frameworks** (CIS, NIST, PCI-DSS, ISO 27001, SOC 2, FedRAMP …) mapped to checks
- JSON API + interactive Scalar documentation at `/api/docs`

## License

Check and compliance data, and the vendored check source under `checks-source/`,
are distributed under the **Apache License 2.0** (see `checks-source/LICENSE`).

## Architecture

- `scripts/ingest.mjs` — fetches the dataset from the upstream data source
  (set via the `HUB_BASE` env var) and emits normalized JSON into `src/data/`
  (committed; this is the build-time snapshot). Brand references are stripped
  during ingestion. The first-party layer is overlaid last, so a refresh never
  drops it.
- `scripts/custom/` — **first-party providers and checks**, see below.
- `checks-source/providers/` — per-check source (`*.py`, fixers, metadata)
  powering the in-app "Source code" viewer: vendored upstream providers plus the
  first-party ones generated from `scripts/custom/`.
- `src/lib/data.ts` — typed data access, filtering & search.
- Pages: `/`, `/check`, `/check/[id]`, `/compliance`, `/compliance/[id]` (detail pages are SSG).
- API: `/api/check`, `/api/check/{id}`, `/api/check/filters`, `/api/check/search`,
  `/api/compliance`, `/api/compliance/{id}`, `/api/compliance/search`, `/api/providers`,
  `/api/n_artifacts`, `/api/admin/config`, `/api/check-of-the-day/*`.
- OpenAPI spec at `/apispec_v1.yaml`, interactive docs at `/api/docs`.

## Refreshing the data

```bash
HUB_BASE="<data-source-base-url>" node scripts/ingest.mjs
```

Then commit `src/data/*` and redeploy. The daily GitHub Action does this
automatically using the `DATA_SOURCE_URL` repository variable.

## First-party checks

`scripts/custom/providers/<id>.mjs` is the single source of truth for APEX Hub's
own providers and checks. Each definition generates both the Python tree under
`checks-source/providers/<id>/` and the dataset entries in `src/data/`, so the
two can never drift.

```bash
node scripts/build-custom.mjs   # regenerate the layer (no upstream access needed)
```

The merge is idempotent and runs automatically at the end of `ingest.mjs`, so the
daily upstream refresh preserves first-party data. Facet counts in `filters.json`
are adjusted incrementally rather than recomputed, keeping exact parity with the
upstream payload.

Current first-party coverage — **135 checks across 17 providers**:

| Area | Providers |
| --- | --- |
| SCM & CI/CD | GitLab, Bitbucket, Jenkins |
| Data & AI | Snowflake, Databricks, OpenAI Platform, Anthropic Console |
| SaaS & identity | Salesforce, Slack, Auth0, Atlassian Cloud |
| Secrets & IaC | HashiCorp Vault, HCP Terraform |
| Extending upstream | Okta, GitHub, MongoDB Atlas, Vercel |

Each provider also gets an `apexhub_threatscore_<id>` compliance framework,
grouping its checks into the four ThreatScore pillars (IAM, Attack Surface,
Logging and Monitoring, Encryption).

### Adding a check

Add it to the provider's `checks` array with `id`, `service`, `pillar`,
`severity`, `title`, `description`, `risk`, `remediation` and a `body` (the
Python `execute()` body). Then run `node scripts/build-custom.mjs`. The loader
validates ids, severities, pillars, service references and required prose, and
fails the build on a collision with an upstream check id.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```
