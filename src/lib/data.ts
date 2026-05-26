import checksIndexRaw from "@/data/checks.index.json";
import complianceIndexRaw from "@/data/compliance.index.json";
import filtersRaw from "@/data/filters.json";
import providersRaw from "@/data/providers.json";
import statsRaw from "@/data/stats.json";
import type {
  Check,
  CheckIndexItem,
  CheckFilters,
  Compliance,
  ComplianceIndexItem,
  Provider,
  Stats,
} from "./types";

export const checksIndex = checksIndexRaw as CheckIndexItem[];
export const complianceIndex = complianceIndexRaw as ComplianceIndexItem[];
export const filters = filtersRaw as unknown as CheckFilters;
export const providers = providersRaw as Provider[];
export const stats = statsRaw as Stats;

let _checksFull: Record<string, Check> | null = null;
let _complianceFull: Record<string, Compliance> | null = null;

export async function getChecksFull(): Promise<Record<string, Check>> {
  if (!_checksFull) _checksFull = (await import("@/data/checks.full.json")).default as unknown as Record<string, Check>;
  return _checksFull;
}
export async function getComplianceFull(): Promise<Record<string, Compliance>> {
  if (!_complianceFull) _complianceFull = (await import("@/data/compliance.full.json")).default as unknown as Record<string, Compliance>;
  return _complianceFull;
}
export async function getCheck(id: string): Promise<Check | null> {
  return (await getChecksFull())[id] ?? null;
}
export async function getCompliance(id: string): Promise<Compliance | null> {
  return (await getComplianceFull())[id] ?? null;
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

export interface CheckQuery {
  providers?: string[];
  types?: string[];
  services?: string[];
  severities?: string[];
  categories?: string[];
  compliances?: string[];
  ids?: string[];
  term?: string;
}

function matchesQuery(c: CheckIndexItem, q: CheckQuery): boolean {
  if (q.providers?.length && !q.providers.includes(c.provider)) return false;
  if (q.services?.length && !q.services.includes(c.service)) return false;
  if (q.severities?.length && !q.severities.includes(c.severity)) return false;
  if (q.ids?.length && !q.ids.includes(c.id)) return false;
  if (q.types?.length && !c.type.some((t) => q.types!.includes(t))) return false;
  if (q.categories?.length && !c.categories.some((x) => q.categories!.includes(x))) return false;
  if (q.compliances?.length && !c.compliances.some((x) => q.compliances!.includes(x))) return false;
  if (q.term) {
    const t = q.term.toLowerCase();
    const hay = `${c.id} ${c.title} ${c.description} ${c.provider} ${c.service} ${c.categories.join(" ")}`.toLowerCase();
    if (!hay.includes(t)) return false;
  }
  return true;
}

function sortChecks(list: CheckIndexItem[], term?: string): CheckIndexItem[] {
  const t = term?.trim().toLowerCase();
  return [...list].sort((a, b) => {
    if (t) {
      const as = scoreCheck(a, t);
      const bs = scoreCheck(b, t);
      if (as !== bs) return bs - as;
    }
    const sr = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (sr !== 0) return sr;
    return a.id.localeCompare(b.id);
  });
}
function scoreCheck(c: CheckIndexItem, t: string): number {
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

/** Filtered, sorted check index items (for the listing page & /api/check). */
export function queryChecks(q: CheckQuery): CheckIndexItem[] {
  return sortChecks(checksIndex.filter((c) => matchesQuery(c, q)), q.term);
}

export function searchCompliance(term: string): ComplianceIndexItem[] {
  const t = (term || "").trim().toLowerCase();
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
  return base;
}
