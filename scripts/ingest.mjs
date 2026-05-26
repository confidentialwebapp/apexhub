#!/usr/bin/env node
/**
 * APEX Hub data ingestion.
 * Reads the open-source prowler-cloud/prowler repo (Apache-2.0) and emits
 * normalized, committed JSON datasets used by the app at build/runtime.
 *
 * Usage: PROWLER_SRC=/path/to/prowler-src node scripts/ingest.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PROWLER_SRC || "/home/kali/prowler-src";
const OUT = join(__dirname, "..", "src", "data");
mkdirSync(OUT, { recursive: true });

function walk(dir, test) {
  const out = [];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) out.push(...walk(p, test));
    else if (test(p)) out.push(p);
  }
  return out;
}

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (err) { console.warn("skip (parse error):", p, err.message); return null; }
}

// ---------- CHECKS ----------
const metaFiles = walk(join(SRC, "prowler", "providers"), (p) => p.endsWith(".metadata.json"));
const checksIndex = [];
const checksFull = {};
const collisions = [];

for (const f of metaFiles) {
  const m = readJSON(f);
  if (!m || !m.CheckID) continue;
  const id = m.CheckID;
  const provider = m.Provider || "";
  const key = `${provider}.${id}`;
  const remediation = m.Remediation || {};
  const code = remediation.Code || {};
  const rec = remediation.Recommendation || {};
  const full = {
    key,
    id,
    title: m.CheckTitle || id,
    provider: m.Provider || "",
    service: m.ServiceName || "",
    subservice: m.SubServiceName || null,
    severity: (m.Severity || "").toLowerCase(),
    resourceType: m.ResourceType || "",
    resourceGroup: m.ResourceGroup || "",
    type: Array.isArray(m.CheckType) ? m.CheckType : [],
    categories: Array.isArray(m.Categories) ? m.Categories : [],
    description: m.Description || "",
    risk: m.Risk || "",
    relatedUrl: m.RelatedUrl || "",
    additionalUrls: Array.isArray(m.AdditionalURLs) ? m.AdditionalURLs : [],
    remediation: {
      cli: code.CLI || "",
      nativeIaC: code.NativeIaC || "",
      terraform: code.Terraform || "",
      other: code.Other || "",
      recommendationText: rec.Text || "",
      recommendationUrl: rec.Url || "",
    },
    dependsOn: m.DependsOn || [],
    relatedTo: m.RelatedTo || [],
    notes: m.Notes || "",
  };
  if (checksFull[key]) collisions.push(key);
  checksFull[key] = full;
  checksIndex.push({
    key,
    id,
    title: full.title,
    description: full.description,
    provider: full.provider,
    service: full.service,
    subservice: full.subservice,
    severity: full.severity,
    type: full.type,
    categories: full.categories,
    resourceType: full.resourceType,
  });
}
checksIndex.sort((a, b) => a.id.localeCompare(b.id));

// ---------- COMPLIANCE ----------
const compFiles = walk(join(SRC, "prowler", "compliance"), (p) => p.endsWith(".json"));
const complianceIndex = [];
const complianceFull = {};
const checkToFrameworks = {}; // checkId -> [{id, name, framework, provider}]

for (const f of compFiles) {
  const c = readJSON(f);
  if (!c || !c.Framework) continue;
  const id = basename(f).replace(/\.json$/, "");
  const reqs = Array.isArray(c.Requirements) ? c.Requirements : [];
  const checkIds = new Set();
  for (const r of reqs) for (const cid of (r.Checks || [])) checkIds.add(cid);
  for (const cid of checkIds) {
    (checkToFrameworks[cid] ||= []).push({ id, name: c.Name || c.Framework, framework: c.Framework, provider: c.Provider || "" });
  }
  const full = {
    id,
    name: c.Name || c.Framework,
    framework: c.Framework || "",
    version: c.Version || "",
    provider: c.Provider || "",
    description: c.Description || "",
    requirementsCount: reqs.length,
    checksCount: checkIds.size,
    requirements: reqs.map((r) => ({
      id: r.Id,
      name: r.Name || "",
      description: r.Description || "",
      checks: r.Checks || [],
      attributes: r.Attributes || [],
    })),
  };
  complianceFull[id] = full;
  complianceIndex.push({
    id,
    name: full.name,
    framework: full.framework,
    version: full.version,
    provider: full.provider,
    description: full.description,
    requirementsCount: full.requirementsCount,
    checksCount: full.checksCount,
  });
}
complianceIndex.sort((a, b) => a.id.localeCompare(b.id));

// ---------- FACETS / STATS ----------
const providers = {};
const services = new Set();
const categories = new Set();
const severities = {};
for (const c of checksIndex) {
  providers[c.provider] = (providers[c.provider] || 0) + 1;
  if (c.service) services.add(c.service);
  for (const cat of c.categories) categories.add(cat);
  severities[c.severity] = (severities[c.severity] || 0) + 1;
}
const stats = {
  generatedAt: new Date().toISOString(),
  source: "prowler-cloud/prowler (Apache-2.0)",
  checks: checksIndex.length,
  compliance: complianceIndex.length,
  providers,
  severities,
  serviceCount: services.size,
  categoryCount: categories.size,
};

function write(name, obj) {
  const p = join(OUT, name);
  writeFileSync(p, JSON.stringify(obj));
  console.log(`wrote ${name}  (${(statSync(p).size / 1024).toFixed(0)} KB)`);
}

write("checks.index.json", checksIndex);
write("checks.full.json", checksFull);
write("compliance.index.json", complianceIndex);
write("compliance.full.json", complianceFull);
write("check-frameworks.json", checkToFrameworks);
write("stats.json", stats);

console.log(`\nchecks: ${checksIndex.length}  compliance: ${complianceIndex.length}`);
if (collisions.length) console.log(`CheckID collisions (${collisions.length}):`, [...new Set(collisions)].slice(0, 10));
