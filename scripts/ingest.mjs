#!/usr/bin/env node
/**
 * APEX Hub data ingestion.
 *
 * Pulls the complete, compiled dataset from the Prowler Hub public API so that
 * every artifact is captured — including iac/llm/image checks that are generated
 * at runtime (from Checkov/Trivy/LLM rulesets) and therefore do NOT exist as
 * metadata files in the prowler-cloud/prowler repo. All data originates from the
 * open-source Prowler project (Apache-2.0).
 *
 * Usage: HUB_BASE=https://hub.prowler.com node scripts/ingest.mjs
 */
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data");
mkdirSync(OUT, { recursive: true });
const HUB = (process.env.HUB_BASE || "https://hub.prowler.com").replace(/\/$/, "");
const NOW = new Date().toISOString();

async function getJSON(path) {
  const res = await fetch(`${HUB}${path}`, {
    headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate, br" },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

// Lower rank wins when an id exists under multiple providers (hub serves the AWS variant).
const PROVIDER_RANK = ["aws", "azure", "gcp", "kubernetes", "m365", "github", "googleworkspace"];
const rank = (p) => {
  const i = PROVIDER_RANK.indexOf(p);
  return i === -1 ? 100 : i;
};

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function write(name, obj) {
  const p = join(OUT, name);
  writeFileSync(p, JSON.stringify(obj));
  console.log(`wrote ${name}  (${(statSync(p).size / 1024).toFixed(0)} KB)`);
}

async function main() {
  console.log(`Source: ${HUB}`);

  // ---------- CHECKS (complete) ----------
  console.log("Fetching all checks…");
  const allChecks = await getJSON("/api/check");
  console.log(`  ${allChecks.length} checks`);

  const checksFull = {}; // id -> object (AWS-precedence)
  const checksIndex = []; // one per provider+id variant
  for (const c of allChecks) {
    const existing = checksFull[c.id];
    if (!existing || rank(c.provider) < rank(existing.provider)) checksFull[c.id] = c;
    checksIndex.push({
      id: c.id,
      title: c.title,
      description: c.description || "",
      provider: c.provider,
      type: Array.isArray(c.type) ? c.type : [],
      service: c.service || "",
      subservice: c.subservice ?? null,
      severity: (c.severity || "").toLowerCase(),
      categories: Array.isArray(c.categories) ? c.categories : [],
      fixer: !!c.fixer,
      compliances: Array.isArray(c.compliances) ? c.compliances.map((x) => x.id) : [],
    });
  }
  checksIndex.sort((a, b) => a.id.localeCompare(b.id) || a.provider.localeCompare(b.provider));

  // ---------- COMPLIANCE (list + per-id full) ----------
  console.log("Fetching compliance frameworks…");
  const compList = await getJSON("/api/compliance?fields=id,name,framework,provider,version,total_checks,total_requirements,description");
  const complianceFull = {};
  await mapLimit(compList, 10, async (c) => {
    try {
      complianceFull[c.id] = await getJSON(`/api/compliance/${encodeURIComponent(c.id)}`);
    } catch (e) {
      console.warn(`  ! ${c.id}: ${e.message}`);
      complianceFull[c.id] = { ...c, requirements: [], created_at: NOW, updated_at: NOW };
    }
  });
  const complianceIndex = compList
    .map((c) => ({
      id: c.id,
      name: c.name,
      framework: c.framework,
      provider: c.provider,
      description: c.description || "",
      version: c.version ?? null,
      total_checks: c.total_checks ?? (complianceFull[c.id]?.total_checks ?? 0),
      total_requirements: c.total_requirements ?? (complianceFull[c.id]?.total_requirements ?? 0),
    }))
    .sort((a, b) => a.framework.localeCompare(b.framework) || a.provider.localeCompare(b.provider));
  console.log(`  ${complianceIndex.length} frameworks`);

  // ---------- FILTERS + PROVIDERS (verbatim for exact facet parity) ----------
  console.log("Fetching filters & providers…");
  const filters = await getJSON("/api/check/filters");
  const providers = await getJSON("/api/providers");

  // ---------- STATS ----------
  const providerCounts = {};
  const severityCounts = {};
  for (const c of checksIndex) {
    providerCounts[c.provider] = (providerCounts[c.provider] || 0) + 1;
    severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1;
  }
  let n_artifacts = checksIndex.length + complianceIndex.length;
  try {
    const na = await getJSON("/api/n_artifacts");
    if (na && typeof na.n === "number") n_artifacts = na.n;
  } catch { /* compute fallback already set */ }

  const stats = {
    generatedAt: NOW,
    source: `Prowler Hub API (${HUB}); data Apache-2.0 (prowler-cloud/prowler + Checkov/Trivy rulesets)`,
    checks: Object.keys(checksFull).length,
    checkVariants: checksIndex.length,
    compliance: complianceIndex.length,
    providers: providerCounts,
    severities: severityCounts,
    serviceCount: (filters.services || []).length,
    categoryCount: (filters.categories || []).length,
    n_artifacts,
  };

  write("checks.index.json", checksIndex);
  write("checks.full.json", checksFull);
  write("compliance.index.json", complianceIndex);
  write("compliance.full.json", complianceFull);
  write("filters.json", filters);
  write("providers.json", providers);
  write("stats.json", stats);

  console.log(
    `\nunique checks: ${stats.checks}  variants: ${stats.checkVariants}  compliance: ${stats.compliance}  artifacts: ${stats.n_artifacts}`
  );
}

main().catch((e) => {
  console.error("ingest failed:", e);
  process.exit(1);
});
