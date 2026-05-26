# APEX Hub

A browsable hub for **cloud security checks** and **compliance frameworks**, with a JSON API and interactive OpenAPI docs. Built with Next.js (App Router, TypeScript) and deployed on Vercel.

- **1,974 checks** across AWS, Azure, GCP, Kubernetes, IaC, M365, GitHub and more
- **103 compliance frameworks** (CIS, NIST, PCI-DSS, ISO 27001, SOC 2, FedRAMP …) mapped to checks
- JSON API + interactive Scalar documentation at `/api/docs`

## License

Check and compliance data, and the vendored check source under `checks-source/`,
are distributed under the **Apache License 2.0** (see `checks-source/LICENSE`).

## Architecture

- `scripts/ingest.mjs` — fetches the dataset from the upstream data source
  (set via the `HUB_BASE` env var) and emits normalized JSON into `src/data/`
  (committed; this is the build-time snapshot). Brand references are stripped
  during ingestion.
- `checks-source/providers/` — vendored per-check source (`*.py`, fixers,
  metadata) powering the in-app "Source code" viewer.
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

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```
