import { checksIndex, getCheck } from "@/lib/data";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(checksIndex.map((c) => c.id))].map((id) => ({ id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await getCheck(decodeURIComponent(id));
  if (!check) return errorJson("Check not found", 404);
  return json(check);
}
