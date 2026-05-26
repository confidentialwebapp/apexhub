import { NextResponse } from "next/server";
import { stats } from "@/lib/data";

export const dynamic = "force-static";

// Public, read-only configuration / dataset summary.
export function GET() {
  return NextResponse.json({
    name: "APEX Hub",
    description: "Cloud security checks & compliance frameworks, sourced from the open-source Prowler project.",
    dataSource: stats.source,
    generatedAt: stats.generatedAt,
    counts: {
      checks: stats.checks,
      compliance: stats.compliance,
      providers: Object.keys(stats.providers).length,
      services: stats.serviceCount,
      categories: stats.categoryCount,
    },
    providers: stats.providers,
    severities: stats.severities,
  });
}
