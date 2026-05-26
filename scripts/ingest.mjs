#!/usr/bin/env node
/**
 * APEX Hub data ingestion — emits datasets matching the Prowler Hub API schema.
 * Reads the open-source prowler-cloud/prowler repo (Apache-2.0).
 *
 * Usage: PROWLER_SRC=/path/to/prowler-src node scripts/ingest.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PROWLER_SRC || "/home/kali/prowler-src";
const OUT = join(__dirname, "..", "src", "data");
mkdirSync(OUT, { recursive: true });
const NOW = new Date().toISOString();

const PROVIDER_NAMES = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  kubernetes: "Kubernetes",
  m365: "Microsoft 365",
  github: "GitHub",
  googleworkspace: "Google Workspace",
  alibabacloud: "Alibaba Cloud",
  oraclecloud: "Oracle Cloud",
  openstack: "OpenStack",
  mongodbatlas: "MongoDB Atlas",
  cloudflare: "Cloudflare",
  nhn: "NHN Cloud",
  scaleway: "Scaleway",
  okta: "Okta",
  vercel: "Vercel",
  iac: "IaC",
  image: "Container Image",
  llm: "LLM",
  common: "Common",
};

// Lower rank wins when an id exists under multiple providers (hub serves the AWS variant).
const PROVIDER_RANK = ["aws", "azure", "gcp", "kubernetes", "m365", "github", "googleworkspace"];
const rank = (p) => {
  const i = PROVIDER_RANK.indexOf(p);
  return i === -1 ? 100 : i;
};

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
function frameworkName(framework) {
  return (framework || "").replace(/-/g, " ").trim();
}

// ---------- COMPLIANCE (first, to build the check->compliances reverse map) ----------
const compFiles = walk(join(SRC, "prowler", "compliance"), (p) => p.endsWith(".json"));
const complianceIndex = [];
const complianceFull = {};
const checkToCompliances = {}; // checkId -> [{id, name}]
const complianceFacet = []; // {id, framework, version, provider, count}

for (const f of compFiles) {
  const c = readJSON(f);
  if (!c || !c.Framework) continue;
  const id = basename(f).replace(/\.json$/, "");
  const reqs = Array.isArray(c.Requirements) ? c.Requirements : [];
  const checkIds = new Set();
  const requirements = reqs.map((r) => {
    for (const cid of (r.Checks || [])) checkIds.add(cid);
    return {
      id: r.Id,
      name: r.Name || undefined,
      description: r.Description || undefined,
      checks: r.Checks || [],
      attributes: r.Attributes || [],
    };
  });
  const friendly = frameworkName(c.Framework);
  for (const cid of checkIds) {
    (checkToCompliances[cid] ||= []).push({ id, name: friendly });
  }
  const full = {
    id,
    name: c.Name || c.Framework,
    framework: c.Framework,
    provider: c.Provider || "",
    description: c.Description || "",
    requirements,
    version: c.Version || null,
    total_checks: checkIds.size,
    total_requirements: requirements.length,
    created_at: NOW,
    updated_at: NOW,
  };
  complianceFull[id] = full;
  complianceIndex.push({
    id,
    name: full.name,
    framework: full.framework,
    provider: full.provider,
    description: full.description,
    version: full.version,
    total_checks: full.total_checks,
    total_requirements: full.total_requirements,
  });
  complianceFacet.push({ id, framework: c.Framework, version: c.Version || null, provider: c.Provider || "", count: checkIds.size });
}
complianceIndex.sort((a, b) => a.framework.localeCompare(b.framework) || a.provider.localeCompare(b.provider));
complianceFacet.sort((a, b) => b.count - a.count);

// ---------- CHECKS ----------
const metaFiles = walk(join(SRC, "prowler", "providers"), (p) => p.endsWith(".metadata.json"));
const checksFull = {}; // id -> hub-shape object (AWS-precedence on collisions)
const checksIndex = []; // one entry per (provider,id) for search/list
const providerServices = {}; // provider -> Set(services)

for (const f of metaFiles) {
  const m = readJSON(f);
  if (!m || !m.CheckID) continue;
  const id = m.CheckID;
  const provider = m.Provider || "";
  const dir = dirname(f);
  const hasFixer = existsSync(join(dir, `${id}_fixer.py`)) || existsSync(join(dir, "fixer.py"));
  const code = (m.Remediation && m.Remediation.Code) || {};
  const reco = (m.Remediation && m.Remediation.Recommendation) || {};
  const service = m.ServiceName || "";
  const subservice = m.SubServiceName ? m.SubServiceName : null;

  if (provider) (providerServices[provider] ||= new Set()).add(service);

  const obj = {
    id,
    title: m.CheckTitle || id,
    description: m.Description || "",
    provider,
    type: Array.isArray(m.CheckType) ? m.CheckType : [],
    service,
    subservice,
    severity: (m.Severity || "").toLowerCase(),
    risk: m.Risk || "",
    reference: null,
    additional_urls: Array.isArray(m.AdditionalURLs) ? m.AdditionalURLs : [],
    remediation: {
      cli: { description: code.CLI || "" },
      terraform: { description: code.Terraform || "" },
      nativeiac: { description: code.NativeIaC || "" },
      other: { description: code.Other || "" },
      wui: { reference: reco.Url || "", description: reco.Text || "" },
    },
    services_required: service ? [service] : [],
    aws_arn_template: m.ResourceIdTemplate || null,
    notes: m.Notes || null,
    compliances: checkToCompliances[id] || [],
    rational_estatement: null,
    remediation_procedure: null,
    audit_procedure: null,
    categories: Array.isArray(m.Categories) ? m.Categories : [],
    default_value: null,
    resource_type: m.ResourceType || "",
    related_url: m.RelatedUrl || null,
    depends_on: Array.isArray(m.DependsOn) ? m.DependsOn : [],
    related_to: Array.isArray(m.RelatedTo) ? m.RelatedTo : [],
    fixer: hasFixer,
  };

  // index entry per provider+id (search/list can show both variants of a colliding id)
  checksIndex.push({
    id,
    title: obj.title,
    description: obj.description,
    provider,
    type: obj.type,
    service,
    subservice,
    severity: obj.severity,
    categories: obj.categories,
    fixer: hasFixer,
    compliances: obj.compliances.map((c) => c.id),
  });

  // full map keyed by bare id, AWS-precedence
  const existing = checksFull[id];
  if (!existing || rank(provider) < rank(existing.provider)) checksFull[id] = obj;
}
checksIndex.sort((a, b) => a.id.localeCompare(b.id) || a.provider.localeCompare(b.provider));

// ---------- FILTERS ----------
const providerCounts = {};
const typeCounts = {};
const serviceCounts = {};
const severityCounts = {};
const categoryCounts = {};
for (const c of checksIndex) {
  providerCounts[c.provider] = (providerCounts[c.provider] || 0) + 1;
  for (const t of c.type) typeCounts[t] = (typeCounts[t] || 0) + 1;
  if (c.service) serviceCounts[c.service] = (serviceCounts[c.service] || 0) + 1;
  severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1;
  for (const cat of c.categories) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
}
const SEV_ORDER = ["critical", "high", "medium", "low", "informational"];
const filters = {
  providers: Object.entries(providerCounts)
    .map(([providerId, count]) => ({ providerId, count, name: PROVIDER_NAMES[providerId] || providerId }))
    .sort((a, b) => b.count - a.count),
  types: Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  services: Object.entries(serviceCounts).map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count),
  severities: Object.entries(severityCounts)
    .map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)),
  categories: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
  compliances: complianceFacet,
};

// ---------- PROVIDERS ----------
const providers = Object.keys(providerServices)
  .sort()
  .map((id) => ({
    id,
    name: PROVIDER_NAMES[id] || id,
    services: [...providerServices[id]].filter(Boolean).sort(),
  }));

// ---------- STATS / ARTIFACTS ----------
const stats = {
  generatedAt: NOW,
  source: "prowler-cloud/prowler (Apache-2.0)",
  checks: Object.keys(checksFull).length,
  checkVariants: checksIndex.length,
  compliance: complianceIndex.length,
  providers: providerCounts,
  severities: severityCounts,
  serviceCount: Object.keys(serviceCounts).length,
  categoryCount: Object.keys(categoryCounts).length,
  n_artifacts: checksIndex.length + complianceIndex.length,
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
write("filters.json", filters);
write("providers.json", providers);
write("stats.json", stats);

console.log(`\nunique checks: ${stats.checks}  variants: ${stats.checkVariants}  compliance: ${stats.compliance}  artifacts: ${stats.n_artifacts}`);
