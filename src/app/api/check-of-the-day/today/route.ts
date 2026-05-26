import { getCheck } from "@/lib/data";
import { pickForDate } from "@/lib/cotd";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const { checkId } = pickForDate(date);
    const check = await getCheck(checkId);
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
