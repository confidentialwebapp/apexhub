import { generateSchedule } from "@/lib/cotd";
import { json, errorJson } from "@/lib/api";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isAdmin(request)) return errorJson("Unauthorized - admin session required", 401);
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 90, 1), 365);
  const schedule = generateSchedule(days);
  return json(
    {
      schedule,
      metadata: { totalDays: schedule.length, overrideCount: 0, lastGenerated: new Date().toISOString() },
    },
    { cache: false }
  );
}
