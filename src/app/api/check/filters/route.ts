import { filters } from "@/lib/data";
import { json } from "@/lib/api";

export const dynamic = "force-static";

export function GET() {
  return json(filters);
}
