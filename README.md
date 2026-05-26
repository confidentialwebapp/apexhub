# APEX Hub

A browsable hub for **cloud security checks** and **compliance frameworks**, with a JSON API and OpenAPI/Redoc docs. Built with Next.js (App Router, TypeScript) and deployed on Vercel.

- **1,353 checks** across AWS, Azure, GCP, Kubernetes, M365, GitHub and more
- **103 compliance frameworks** (CIS, NIST, PCI-DSS, ISO 27001, SOC 2, …) mapped to checks
- Read-only JSON API + Redoc documentation at `/api/docs`

## Data source & license

All check and compliance data is sourced from the open-source
[Prowler](https://github.com/prowler-cloud/prowler) project, licensed under **Apache-2.0**.
This is an independent deployment and is **not affiliated with or endorsed by** Prowler / ProwlerPro.
Data is a build-time snapshot — re-run ingestion and redeploy to refresh.

## Architecture

- `scripts/ingest.mjs` — reads a local clone of `prowler-cloud/prowler` and emits normalized
  JSON datasets into `src/data/` (committed; this is the build-time snapshot).
- `src/lib/data.ts` — typed data access + search.
- Pages: `/`, `/checks`, `/check/[key]`, `/compliance`, `/compliance/[id]` (detail pages are SSG).
- API: `/api/check/search`, `/api/check/[key]`, `/api/compliance/search`, `/api/compliance/[id]`,
  `/api/admin/config`, `/api/openapi.json`, and Redoc UI at `/api/docs`.

## Refreshing the data

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/prowler-cloud/prowler.git ../prowler-src
cd ../prowler-src && git sparse-checkout set prowler/providers prowler/compliance && cd -
PROWLER_SRC=../prowler-src node scripts/ingest.mjs
```

Then commit `src/data/*` and redeploy.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```
