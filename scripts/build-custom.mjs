#!/usr/bin/env node
/**
 * Regenerates the first-party check layer.
 *
 *   1. writes the Python + metadata tree into checks-source/providers/
 *   2. overlays the checks, providers and compliance frameworks onto the
 *      dataset snapshot in src/data/
 *
 * Runs standalone (no upstream access needed):
 *
 *   node scripts/build-custom.mjs
 *
 * scripts/ingest.mjs calls the same merge after each upstream refresh, so the
 * daily sync never drops first-party data.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDefinitions, assertNoUpstreamCollision } from "./custom/index.mjs";
import { emitProvider } from "./custom/lib/emit.mjs";
import { mergeCustom } from "./custom/lib/merge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "data");
const SOURCE = join(ROOT, "checks-source", "providers");

const read = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));
const write = (name, obj) => {
  const p = join(DATA, name);
  writeFileSync(p, JSON.stringify(obj));
  console.log(`  wrote ${name}  (${(statSync(p).size / 1024).toFixed(0)} KB)`);
};

const defs = await loadDefinitions();
console.log(`Loaded ${defs.length} first-party providers.`);

console.log("Emitting check source…");
let emitted = 0;
for (const def of defs) emitted += emitProvider(def, SOURCE).length;
console.log(`  ${emitted} directories written under checks-source/providers/`);

console.log("Merging into the dataset snapshot…");
const data = {
  checksIndex: read("checks.index.json"),
  checksFull: read("checks.full.json"),
  complianceIndex: read("compliance.index.json"),
  complianceFull: read("compliance.full.json"),
  filters: read("filters.json"),
  providers: read("providers.json"),
  stats: read("stats.json"),
};

// The snapshot already contains the previous run's first-party checks, so those
// ids are expected; anything else colliding is a genuine upstream clash.
assertNoUpstreamCollision(
  defs,
  data.checksFull,
  new Set(defs.flatMap((d) => d.checks.map((c) => c.id)))
);

const out = mergeCustom(data, defs);

write("checks.index.json", out.checksIndex);
write("checks.full.json", out.checksFull);
write("compliance.index.json", out.complianceIndex);
write("compliance.full.json", out.complianceFull);
write("filters.json", out.filters);
write("providers.json", out.providers);
write("stats.json", out.stats);

console.log(
  `\n+${out.addedChecks} first-party checks across ${defs.length} providers` +
    `\ntotal checks: ${out.stats.checks}  compliance: ${out.stats.compliance}  artifacts: ${out.stats.n_artifacts}`
);
