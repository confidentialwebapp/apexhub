import { checksIndex } from "./data";

function dayHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let _ids: { id: string; provider: string }[] | null = null;
function uniqueChecks() {
  if (!_ids) {
    const seen = new Set<string>();
    _ids = [];
    for (const c of [...checksIndex].sort((a, b) => a.id.localeCompare(b.id))) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      _ids.push({ id: c.id, provider: c.provider });
    }
  }
  return _ids;
}

export function pickForDate(dateStr: string): { checkId: string; provider: string } {
  const list = uniqueChecks();
  const c = list[dayHash(dateStr) % list.length];
  return { checkId: c.id, provider: c.provider };
}

export interface ScheduleEntry {
  date: string;
  checkId: string;
  provider: string;
  isOverride: boolean;
  overriddenBy: string | null;
  overriddenAt: string | null;
}

export function generateSchedule(days: number, startDate = new Date()): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const { checkId, provider } = pickForDate(date);
    out.push({ date, checkId, provider, isOverride: false, overriddenBy: null, overriddenAt: null });
  }
  return out;
}
