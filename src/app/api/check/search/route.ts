import { queryChecks, getChecksFull } from "@/lib/data";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const term = sp.get("term") ?? sp.get("q") ?? "";
    const items = queryChecks({ term });
    const full = await getChecksFull();
    const out = items.map((i) => full[i.id]).filter(Boolean);
    return json(out);
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
