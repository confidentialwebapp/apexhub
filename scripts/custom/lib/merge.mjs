/**
 * Overlays first-party checks, providers and compliance frameworks onto the
 * upstream dataset snapshot.
 *
 * The upstream facet payloads (`filters.json`) are served verbatim for exact
 * parity, so facets are adjusted incrementally rather than recomputed. The
 * merge is idempotent: any first-party artifact already present is subtracted
 * before the fresh version is added, so re-running never double-counts.
 */
import { toHubCheck, toIndexItem, toThreatScore, FRAMEWORK_NAME } from "./transform.mjs";

/** Add `delta` to the facet row matching `key`, creating the row if needed. */
function bump(rows, keyField, key, delta, extra = {}) {
  let row = rows.find((r) => r[keyField] === key);
  if (!row) {
    if (delta <= 0) return;
    row = { [keyField]: key, count: "0", ...extra };
    rows.push(row);
  }
  const next = Number(row.count) + delta;
  // Upstream serves these counts as strings; preserve the wire type.
  row.count = typeof row.count === "number" ? next : String(next);
  if (next <= 0) rows.splice(rows.indexOf(row), 1);
}

/** Facet contributions of one index item, as [rowsKey, keyField, key, extra] tuples. */
function contributions(item, providerName) {
  const out = [
    ["providers", "providerId", item.provider, { name: providerName }],
    ["services", "service", item.service, {}],
    ["severities", "severity", item.severity, {}],
  ];
  for (const t of item.type) out.push(["types", "type", t, {}]);
  for (const c of item.categories) out.push(["categories", "category", c, {}]);
  return out;
}

function applyFacets(filters, item, providerName, delta) {
  for (const [rowsKey, keyField, key, extra] of contributions(item, providerName)) {
    bump(filters[rowsKey], keyField, key, delta, extra);
  }
}

/**
 * @param data  { checksIndex, checksFull, complianceIndex, complianceFull, filters, providers, stats }
 * @param defs  array of provider definitions
 */
export function mergeCustom(data, defs) {
  const { checksIndex, checksFull, complianceIndex, complianceFull, filters, providers, stats } = data;

  const customCheckIds = new Set(defs.flatMap((d) => d.checks.map((c) => c.id)));
  const customFrameworkIds = new Set(defs.map((d) => `apexhub_threatscore_${d.id}`));
  const providerName = (id) =>
    defs.find((d) => d.id === id)?.name ??
    providers.find((p) => p.id === id)?.name ??
    id;

  // ---------- subtract any previous run ----------
  for (const item of checksIndex) {
    if (customCheckIds.has(item.id)) applyFacets(filters, item, providerName(item.provider), -1);
  }
  let index = checksIndex.filter((c) => !customCheckIds.has(c.id));
  for (const id of customCheckIds) delete checksFull[id];

  for (const fw of customFrameworkIds) {
    const i = filters.compliances.findIndex((c) => c.id === fw);
    if (i !== -1) filters.compliances.splice(i, 1);
    delete complianceFull[fw];
  }
  let compIndex = complianceIndex.filter((c) => !customFrameworkIds.has(c.id));

  // ---------- add ----------
  let addedChecks = 0;
  for (const def of defs) {
    const framework = toThreatScore(def);
    const mappedIds = [framework.id];

    for (const check of def.checks) {
      const hubCheck = toHubCheck(def, check, mappedIds);
      const item = toIndexItem(def, check, mappedIds);
      checksFull[check.id] = hubCheck;
      index.push(item);
      applyFacets(filters, item, def.name, +1);
      addedChecks += 1;
    }

    complianceFull[framework.id] = framework;
    compIndex.push({
      id: framework.id,
      name: framework.name,
      framework: framework.framework,
      provider: framework.provider,
      description: framework.description,
      version: framework.version,
      total_checks: framework.total_checks,
      total_requirements: framework.total_requirements,
    });
    filters.compliances.push({
      id: framework.id,
      framework: FRAMEWORK_NAME,
      version: framework.version,
      provider: def.name,
      count: framework.total_checks,
    });

    // providers.json: new providers are appended, extended ones gain services.
    const services = [...new Set(def.checks.map((c) => c.service))].sort();
    const existing = providers.find((p) => p.id === def.id);
    if (existing) {
      existing.services = [...new Set([...existing.services, ...services])];
    } else {
      providers.push({ id: def.id, name: def.name, services });
    }
  }

  index.sort((a, b) => a.id.localeCompare(b.id) || a.provider.localeCompare(b.provider));
  compIndex.sort((a, b) => a.framework.localeCompare(b.framework) || a.provider.localeCompare(b.provider));

  // ---------- stats ----------
  const providerCounts = {};
  const severityCounts = {};
  for (const c of index) {
    providerCounts[c.provider] = (providerCounts[c.provider] || 0) + 1;
    severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1;
  }
  const merged = {
    ...stats,
    checks: Object.keys(checksFull).length,
    checkVariants: index.length,
    compliance: compIndex.length,
    providers: providerCounts,
    severities: severityCounts,
    serviceCount: filters.services.length,
    categoryCount: filters.categories.length,
    n_artifacts: index.length + compIndex.length,
    firstParty: { checks: addedChecks, providers: defs.length },
  };

  return {
    checksIndex: index,
    checksFull,
    complianceIndex: compIndex,
    complianceFull,
    filters,
    providers,
    stats: merged,
    addedChecks,
  };
}
