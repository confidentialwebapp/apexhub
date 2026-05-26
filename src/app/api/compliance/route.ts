import { complianceIndex } from "@/lib/data";
import { csv, project, json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const provider = sp.get("provider");
    const fields = csv(sp, "fields");
    let items = complianceIndex as unknown as Record<string, unknown>[];
    if (provider) items = items.filter((c) => String(c.provider).toLowerCase() === provider.toLowerCase());
    return json(items.map((c) => project(c, fields)));
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
