// Schema mirrors the Prowler Hub API.

export interface RemediationItem {
  description: string;
}
export interface WuiRemediation {
  reference: string;
  description: string;
}
export interface Remediation {
  cli: RemediationItem;
  terraform: RemediationItem;
  nativeiac: RemediationItem;
  other: RemediationItem;
  wui: WuiRemediation;
}
export interface ComplianceRef {
  id: string;
  name: string;
}

export interface Check {
  id: string;
  title: string;
  description: string;
  provider: string;
  type: string[];
  service: string;
  subservice: string | null;
  severity: string;
  risk: string;
  reference: string[] | null;
  additional_urls: string[];
  remediation: Remediation;
  services_required: string[];
  aws_arn_template: string | null;
  notes: string | null;
  compliances: ComplianceRef[];
  rational_estatement: string | null;
  remediation_procedure: string | null;
  audit_procedure: string | null;
  categories: string[];
  default_value: string | null;
  resource_type: string;
  related_url: string | null;
  depends_on: string[];
  related_to: string[];
  fixer: boolean;
}

export interface CheckIndexItem {
  id: string;
  title: string;
  description: string;
  provider: string;
  type: string[];
  service: string;
  subservice: string | null;
  severity: string;
  categories: string[];
  fixer: boolean;
  compliances: string[];
}

export interface Requirement {
  id: string;
  name?: string;
  description?: string;
  checks: string[];
  attributes: Record<string, unknown>[];
}

export interface Compliance {
  id: string;
  name: string;
  framework: string;
  provider: string;
  description: string;
  requirements: Requirement[];
  version: string | null;
  total_checks: number;
  total_requirements: number;
  created_at: string;
  updated_at: string;
}

export interface ComplianceIndexItem {
  id: string;
  name: string;
  framework: string;
  provider: string;
  description: string;
  version: string | null;
  total_checks: number;
  total_requirements: number;
}

export interface Provider {
  id: string;
  name: string;
  services: string[];
}

// The hub returns most facet counts as strings ("602") and compliance counts as numbers;
// kept loose to preserve exact parity with the upstream payload.
type Count = number | string;
export interface CheckFilters {
  providers: { providerId: string; count: Count; name: string }[];
  types: { type: string; count: Count }[];
  services: { service: string; count: Count }[];
  severities: { severity: string; count: Count }[];
  categories: { category: string; count: Count }[];
  compliances: { id: string; framework: string; version: string | null; provider: string; count: Count }[];
}

export interface Stats {
  generatedAt: string;
  source: string;
  checks: number;
  checkVariants: number;
  compliance: number;
  providers: Record<string, number>;
  severities: Record<string, number>;
  serviceCount: number;
  categoryCount: number;
  n_artifacts: number;
}
