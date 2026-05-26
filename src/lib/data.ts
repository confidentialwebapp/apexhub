import checksIndexRaw from "@/data/checks.index.json";
import complianceIndexRaw from "@/data/compliance.index.json";
import statsRaw from "@/data/stats.json";
import type {
  CheckIndexItem,
  CheckFull,
  ComplianceIndexItem,
  ComplianceFull,
  Stats,
} from "./types";

export const checksIndex = checksIndexRaw as CheckIndexItem[];
export const complianceIndex = complianceIndexRaw as ComplianceIndexItem[];
export const stats = statsRaw as Stats;

// Full datasets are large; load lazily and only where needed (detail pages,
// which are statically generated at build time).
let _checksFull: Record<string, CheckFull> | null = null;
let _complianceFull: Record<string, ComplianceFull> | null = null;

export async function getChecksFull(): Promise<Record<string, CheckFull>> {
  if (!_checksFull) {
    _checksFull = (await import("@/data/checks.full.json")).default as Record<string, CheckFull>;
  }
  return _checksFull;
}

export async function getComplianceFull(): Promise<Record<string, ComplianceFull>> {
  if (!_complianceFull) {
    _complianceFull = (await import("@/data/compliance.full.json")).default as Record<string, ComplianceFull>;
  }
  return _complianceFull;
}

export async function getCheck(key: string): Promise<CheckFull | null> {
  const all = await getChecksFull();
  return all[key] ?? null;
}

export interface FrameworkRef {
  id: string;
  name: string;
  framework: string;
  provider: string;
}

let _checkFrameworks: Record<string, FrameworkRef[]> | null = null;

export async function getFrameworksForCheck(checkId: string): Promise<FrameworkRef[]> {
  if (!_checkFrameworks) {
    _checkFrameworks = (await import("@/data/check-frameworks.json")).default as Record<string, FrameworkRef[]>;
  }
  return _checkFrameworks[checkId] ?? [];
}

export async function getCompliance(id: string): Promise<ComplianceFull | null> {
  const all = await getComplianceFull();
  return all[id] ?? null;
}

// Map a bare check id -> available keys (an id may exist under multiple providers).
const idToKeys: Record<string, string[]> = {};
for (const c of checksIndex) (idToKeys[c.id] ||= []).push(c.key);

/** Resolve a check id (from a compliance requirement) to a detail key, using a provider hint. */
export function resolveCheckKey(checkId: string, providerHint = ""): string | null {
  const keys = idToKeys[checkId];
  if (!keys || keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  const hint = providerHint.toLowerCase();
  return keys.find((k) => k.startsWith(`${hint}.`)) ?? keys[0];
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

/** Lightweight scored search over the check index. */
export function searchChecks(term: string, limit = 200): CheckIndexItem[] {
  const t = term.trim().toLowerCase();
  const base = !t
    ? checksIndex
    : checksIndex.filter((c) => {
        return (
          c.id.toLowerCase().includes(t) ||
          c.title.toLowerCase().includes(t) ||
          c.description.toLowerCase().includes(t) ||
          c.provider.toLowerCase().includes(t) ||
          c.service.toLowerCase().includes(t) ||
          c.resourceType.toLowerCase().includes(t) ||
          c.categories.some((x) => x.toLowerCase().includes(t))
        );
      });
  const scored = [...base].sort((a, b) => {
    if (t) {
      const ascore = score(a, t);
      const bscore = score(b, t);
      if (ascore !== bscore) return bscore - ascore;
    }
    const sr = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (sr !== 0) return sr;
    return a.id.localeCompare(b.id);
  });
  return scored.slice(0, limit);
}

function score(c: CheckIndexItem, t: string): number {
  let s = 0;
  if (c.id.toLowerCase() === t) s += 100;
  if (c.id.toLowerCase().includes(t)) s += 40;
  if (c.title.toLowerCase().includes(t)) s += 20;
  if (c.service.toLowerCase() === t) s += 15;
  if (c.provider.toLowerCase() === t) s += 10;
  if (c.categories.some((x) => x.toLowerCase().includes(t))) s += 8;
  if (c.description.toLowerCase().includes(t)) s += 4;
  return s;
}

export function searchCompliance(term: string, limit = 200): ComplianceIndexItem[] {
  const t = term.trim().toLowerCase();
  const base = !t
    ? complianceIndex
    : complianceIndex.filter(
        (c) =>
          c.id.toLowerCase().includes(t) ||
          c.name.toLowerCase().includes(t) ||
          c.framework.toLowerCase().includes(t) ||
          c.provider.toLowerCase().includes(t) ||
          c.description.toLowerCase().includes(t)
      );
  return [...base]
    .sort((a, b) => a.framework.localeCompare(b.framework) || a.provider.localeCompare(b.provider))
    .slice(0, limit);
}
