/**
 * Loads every first-party provider definition and validates it before use.
 *
 * Definitions live in scripts/custom/providers/<id>.mjs and are the single
 * source of truth: both the Python tree under checks-source/ and the dataset
 * entries under src/data/ are generated from them.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PILLARS } from "./lib/transform.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEVERITIES = new Set(["critical", "high", "medium", "low", "informational"]);

export async function loadDefinitions() {
  const files = readdirSync(join(HERE, "providers"))
    .filter((f) => f.endsWith(".mjs"))
    .sort();

  const defs = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(join(HERE, "providers", file)).href);
    defs.push(mod.default);
  }
  validate(defs);
  return defs;
}

function validate(defs) {
  const seen = new Set();
  for (const def of defs) {
    if (!def.id || !def.name) throw new Error(`provider definition missing id/name`);
    if (!def.extendsUpstream) {
      for (const key of ["pyClass", "baseUrl", "errorCodeBase", "services"]) {
        if (!def[key]) throw new Error(`${def.id}: missing "${key}"`);
      }
    }
    for (const check of def.checks) {
      if (seen.has(check.id)) throw new Error(`duplicate check id: ${check.id}`);
      seen.add(check.id);

      if (!check.id.startsWith(`${def.id}_`) && !def.extendsUpstream) {
        throw new Error(`${check.id}: id must be prefixed with "${def.id}_"`);
      }
      if (!SEVERITIES.has(check.severity)) {
        throw new Error(`${check.id}: bad severity "${check.severity}"`);
      }
      if (!PILLARS[check.pillar]) {
        throw new Error(`${check.id}: bad pillar "${check.pillar}"`);
      }
      const known = { ...(def.services ?? {}), ...(def.newServices ?? {}) };
      if (!def.extendsUpstream && !known[check.service]) {
        throw new Error(`${check.id}: unknown service "${check.service}"`);
      }
      for (const field of ["title", "description", "risk", "body"]) {
        if (!check[field]?.trim()) throw new Error(`${check.id}: empty "${field}"`);
      }
      if (!check.remediation?.text?.trim()) {
        throw new Error(`${check.id}: missing remediation.text`);
      }
    }
  }
}

/** Guard against colliding with an upstream check id. */
export function assertNoUpstreamCollision(defs, upstreamChecksFull, previousCustomIds = new Set()) {
  for (const def of defs) {
    for (const check of def.checks) {
      if (upstreamChecksFull[check.id] && !previousCustomIds.has(check.id)) {
        throw new Error(
          `${check.id}: collides with an upstream check id — rename the first-party check`
        );
      }
    }
  }
}
