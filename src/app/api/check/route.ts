import { queryChecks, getChecksFull } from "@/lib/data";
import { csv, project, json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const items = queryChecks({
      providers: csv(sp, "providers"),
      types: csv(sp, "types"),
      services: csv(sp, "services"),
      severities: csv(sp, "severities"),
      categories: csv(sp, "categories"),
      compliances: csv(sp, "compliances"),
      ids: csv(sp, "ids"),
    });
    const fields = csv(sp, "fields");
    const limit = Number(sp.get("limit")) || 0;
    const sliced = limit > 0 ? items.slice(0, limit) : items;
    const full = await getChecksFull();
    const out = sliced.map((i) => project(full[i.id] ?? i, fields));
    return json(out);
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
