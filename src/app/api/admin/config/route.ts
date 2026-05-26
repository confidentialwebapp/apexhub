import { json } from "@/lib/api";

export const dynamic = "force-static";

const POPULAR_CHECKS = [
  "s3_bucket_public_access",
  "iam_root_hardware_mfa_enabled",
  "ec2_instance_public_ip",
  "rds_instance_no_public_access",
  "cloudtrail_multi_region_enabled",
];
const POPULAR_COMPLIANCES = ["cis_3.0_aws", "nist_800_53_revision_5_aws", "pci_4.0_aws", "iso27001_2022_aws"];

export function GET() {
  return json({
    id: "default",
    popular_checks: POPULAR_CHECKS.map((id) => ({ id })),
    popular_compliances: POPULAR_COMPLIANCES.map((id) => ({ id })),
    news: [],
  });
}
