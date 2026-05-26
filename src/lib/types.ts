export interface CheckIndexItem {
  key: string;
  id: string;
  title: string;
  description: string;
  provider: string;
  service: string;
  subservice: string | null;
  severity: string;
  type: string[];
  categories: string[];
  resourceType: string;
}

export interface CheckRemediation {
  cli: string;
  nativeIaC: string;
  terraform: string;
  other: string;
  recommendationText: string;
  recommendationUrl: string;
}

export interface CheckFull extends CheckIndexItem {
  resourceGroup: string;
  risk: string;
  relatedUrl: string;
  additionalUrls: string[];
  remediation: CheckRemediation;
  dependsOn: string[];
  relatedTo: string[];
  notes: string;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  checks: string[];
  attributes: Record<string, unknown>[];
}

export interface ComplianceIndexItem {
  id: string;
  name: string;
  framework: string;
  version: string;
  provider: string;
  description: string;
  requirementsCount: number;
  checksCount: number;
}

export interface ComplianceFull extends ComplianceIndexItem {
  requirements: ComplianceRequirement[];
}

export interface Stats {
  generatedAt: string;
  source: string;
  checks: number;
  compliance: number;
  providers: Record<string, number>;
  severities: Record<string, number>;
  serviceCount: number;
  categoryCount: number;
}
