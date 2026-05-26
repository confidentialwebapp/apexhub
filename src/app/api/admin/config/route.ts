import { json, errorJson } from "@/lib/api";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const POPULAR_CHECKS = [
  "s3_bucket_public_access",
  "iam_root_hardware_mfa_enabled",
  "ec2_instance_public_ip",
  "rds_instance_no_public_access",
  "cloudtrail_multi_region_enabled",
];
const POPULAR_COMPLIANCES = ["cis_3.0_aws", "nist_800_53_revision_5_aws", "pci_4.0_aws", "iso27001_2022_aws"];

function defaultConfig() {
  return {
    id: "default",
    popular_checks: POPULAR_CHECKS.map((id) => ({ id })),
    popular_compliances: POPULAR_COMPLIANCES.map((id) => ({ id })),
    news: [] as string[],
  };
}

export function GET() {
  return json(defaultConfig());
}

// Validated but not persisted (static-data deployment); echoes the merged config.
export async function PUT(request: Request) {
  if (!isAdmin(request)) return errorJson("Unauthorized - admin session required", 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }
  return json({ ...defaultConfig(), ...body, id: "default" }, { cache: false });
}
