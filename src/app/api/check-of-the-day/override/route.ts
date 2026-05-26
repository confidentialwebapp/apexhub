import { getCheck } from "@/lib/data";
import { json, errorJson } from "@/lib/api";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Validated but not persisted (static-data deployment).
export async function PUT(request: Request) {
  if (!isAdmin(request)) return errorJson("Unauthorized - admin session required", 401);
  let body: { date?: string; checkId?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }
  const { date, checkId } = body;
  if (!date || !checkId) return errorJson("Missing required fields", 400);
  const check = await getCheck(checkId);
  return json(
    {
      success: true,
      entry: {
        date,
        checkId,
        provider: check?.provider ?? "",
        isOverride: true,
        overriddenBy: "admin",
        overriddenAt: new Date().toISOString(),
      },
    },
    { cache: false }
  );
}
