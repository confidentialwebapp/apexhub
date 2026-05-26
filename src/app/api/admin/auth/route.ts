import { NextResponse } from "next/server";
import { checkCredentials, sessionCookie } from "@/lib/admin";
import { errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }
  const { username, password } = body;
  if (!username || !password) return errorJson("Missing credentials", 400);
  if (!checkCredentials(username, password)) return errorJson("Invalid credentials", 401);

  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie() },
  });
}
