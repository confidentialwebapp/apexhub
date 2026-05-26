import { NextResponse } from "next/server";
import { checksIndex, getCheck } from "@/lib/data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return checksIndex.map((c) => ({ key: c.key }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const check = await getCheck(key);
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(check);
}
