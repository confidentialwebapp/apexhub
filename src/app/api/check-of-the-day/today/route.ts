import { checksIndex, getCheck } from "@/lib/data";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// Deterministic pick: same check for everyone on a given UTC day.
function dayHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function GET(request: Request) {
  try {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const ids = [...new Set(checksIndex.map((c) => c.id))].sort();
    const id = ids[dayHash(date) % ids.length];
    const check = await getCheck(id);
    if (!check) return errorJson("No check scheduled for today", 404);

    const origin = new URL(request.url).origin;
    return json({
      date,
      check: {
        id: check.id,
        title: check.title,
        description: check.description,
        provider: check.provider,
        service: check.service,
        severity: check.severity,
        categories: check.categories,
        fixer: check.fixer,
        url: `${origin}/check/${check.id}`,
        api_url: `${origin}/api/check?ids=${check.id}`,
      },
    });
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
