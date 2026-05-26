import { NextResponse } from "next/server";

export function csv(searchParams: URLSearchParams, key: string): string[] | undefined {
  const v = searchParams.get(key);
  if (!v) return undefined;
  const arr = v.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export function project<T extends object>(obj: T, fields?: string[]): T | Record<string, unknown> {
  if (!fields || fields.length === 0) return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in src) out[f] = src[f];
  return out;
}

const CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export function json(data: unknown, init?: { status?: number; cache?: boolean }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.cache === false ? undefined : { "Cache-Control": CACHE },
  });
}

export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
