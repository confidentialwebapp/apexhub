import { generateSchedule } from "@/lib/cotd";
import { json, errorJson } from "@/lib/api";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Validated but not persisted (deterministic schedule is derived from the date).
export async function POST(request: Request) {
  if (!isAdmin(request)) return errorJson("Unauthorized - admin session required", 401);
  let body: { days?: number; startDate?: string; preserveOverrides?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* body optional */
  }
  const days = Math.min(Math.max(Number(body.days) || 90, 1), 365);
  const start = body.startDate ? new Date(body.startDate) : new Date();
  const schedule = generateSchedule(days, start);
  return json(
    {
      success: true,
      scheduleGenerated: schedule.length,
      overridesPreserved: 0,
      lastGenerated: new Date().toISOString(),
    },
    { cache: false }
  );
}
