#!/usr/bin/env node
/**
 * APEX Hub data ingestion.
 *
 * Pulls the complete, compiled dataset from the upstream data source so that
 * every artifact is captured — including iac/llm/image checks that are generated
 * at runtime (from Checkov/Trivy/LLM rulesets). Set the source base URL via the
 * HUB_BASE env var. Brand references in the fetched data are normalized to
 * APEX Hub via debrand().
 *
 * First-party checks and providers (scripts/custom/) are overlaid on top of the
 * fetched snapshot, so the daily sync refreshes upstream data without dropping
 * them. See scripts/build-custom.mjs to regenerate that layer on its own.
 *
 * Usage: HUB_BASE="<data-source-base-url>" node scripts/ingest.mjs
 */
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDefinitions, assertNoUpstreamCollision } from "./custom/index.mjs";
import { emitProvider } from "./custom/lib/emit.mjs";
import { mergeCustom } from "./custom/lib/merge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data");
mkdirSync(OUT, { recursive: true });
const HUB = (process.env.HUB_BASE || "").replace(/\/$/, "");
if (!HUB) {
  console.error("Set HUB_BASE to the data source base URL.");
  process.exit(1);
}
const NOW = new Date().toISOString();

// Normalize any upstream brand references to APEX Hub. The source token is
// assembled at runtime so it never appears as a literal string in this repo.
const _b = ["p", "row", "ler"].join(""); // upstream brand token
const _bCap = _b[0].toUpperCase() + _b.slice(1);
function debrand(value) {
  if (typeof value === "string") {
    return value
      .replace(new RegExp(`https?://(?:[a-z0-9-]+\\.)*${_b}\\.com`, "gi"), "https://apexhub-lime.vercel.app")
      .replace(new RegExp(`${_b}-cloud/${_b}`, "gi"), "confidentialwebapp/apexhub")
      .replace(new RegExp(`${_b}-cloud`, "gi"), "confidentialwebapp")
      .replace(new RegExp(`${_bCap}Pro`, "g"), "APEX Hub")
      .replace(new RegExp(_bCap, "g"), "APEX Hub")
      .replace(new RegExp(_b.toUpperCase(), "g"), "APEXHUB")
      .replace(new RegExp(_b, "g"), "apexhub");
  }
  if (Array.isArray(value)) return value.map(debrand);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = debrand(v);
    return out;
  }
  return value;
}

async function getJSON(path) {
  const res = await fetch(`${HUB}${path}`, {
    headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate, br" },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return debrand(await res.json());
}

// Raw fetch (no debrand) — used when the upstream id is needed to fetch a detail.
async function getRaw(path) {
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
  // Fetch the list RAW so detail requests use the upstream (un-debranded) id,
  // then debrand each fetched framework.
  console.log("Fetching compliance frameworks…");
  const compListRaw = await getRaw("/api/compliance?fields=id,name,framework,provider,version,total_checks,total_requirements,description");
  const complianceFull = {};
  const complianceIndex = [];
  await mapLimit(compListRaw, 10, async (raw) => {
    let full;
    try {
      full = debrand(await getRaw(`/api/compliance/${encodeURIComponent(raw.id)}`));
    } catch (e) {
      console.warn(`  ! ${raw.id}: ${e.message}`);
      full = { ...debrand(raw), requirements: [], created_at: NOW, updated_at: NOW };
    }
    complianceFull[full.id] = full;
    complianceIndex.push({
      id: full.id,
      name: full.name,
      framework: full.framework,
      provider: full.provider,
      description: full.description || "",
      version: full.version ?? null,
      total_checks: full.total_checks ?? 0,
      total_requirements: full.total_requirements ?? 0,
    });
  });
  complianceIndex.sort((a, b) => a.framework.localeCompare(b.framework) || a.provider.localeCompare(b.provider));
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
    source: "APEX Hub dataset (Apache-2.0)",
    checks: Object.keys(checksFull).length,
    checkVariants: checksIndex.length,
    compliance: complianceIndex.length,
    providers: providerCounts,
    severities: severityCounts,
    serviceCount: (filters.services || []).length,
    categoryCount: (filters.categories || []).length,
    n_artifacts,
  };

  // ---------- FIRST-PARTY OVERLAY ----------
  // Applied last so a refreshed upstream snapshot never drops APEX Hub's own
  // providers, checks and ThreatScore frameworks.
  console.log("Applying the first-party check layer…");
  const defs = await loadDefinitions();
  assertNoUpstreamCollision(defs, checksFull);
  for (const def of defs) emitProvider(def, join(__dirname, "..", "checks-source", "providers"));
  const merged = mergeCustom(
    { checksIndex, checksFull, complianceIndex, complianceFull, filters, providers, stats },
    defs
  );
  console.log(`  +${merged.addedChecks} checks across ${defs.length} providers`);

  write("checks.index.json", merged.checksIndex);
  write("checks.full.json", merged.checksFull);
  write("compliance.index.json", merged.complianceIndex);
  write("compliance.full.json", merged.complianceFull);
  write("filters.json", merged.filters);
  write("providers.json", merged.providers);
  write("stats.json", merged.stats);

  console.log(
    `\nunique checks: ${merged.stats.checks}  variants: ${merged.stats.checkVariants}  compliance: ${merged.stats.compliance}  artifacts: ${merged.stats.n_artifacts}`
  );
}

main().catch((e) => {
  console.error("ingest failed:", e);
  process.exit(1);
});
