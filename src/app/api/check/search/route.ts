import { NextResponse } from "next/server";
import { searchChecks } from "@/lib/data";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("term") ?? searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000);
  const results = searchChecks(term, limit);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
