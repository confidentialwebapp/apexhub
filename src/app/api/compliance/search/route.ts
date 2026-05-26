import { searchCompliance } from "@/lib/data";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// Returns framework summaries (id, name, framework, provider, version, totals).
// Requirement bodies are available from /api/compliance/{id} to keep responses small.
export function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const term = sp.get("term") ?? sp.get("q") ?? "";
    return json(searchCompliance(term));
  } catch (e) {
    return errorJson((e as Error).message, 500);
  }
}
