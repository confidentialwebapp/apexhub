import { stats } from "@/lib/data";
import { json } from "@/lib/api";

export const dynamic = "force-static";

export function GET() {
  return json({ n: stats.n_artifacts });
}
