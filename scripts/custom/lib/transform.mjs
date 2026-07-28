/**
 * Transforms between the three representations of a first-party check:
 *
 *   definition (scripts/custom/providers/*.mjs)
 *     -> <check>.metadata.json   (upstream on-disk format, PascalCase)
 *     -> hub Check               (src/data/checks.full.json, snake_case)
 *
 * The hub-Check mapping mirrors upstream exactly, including its null-vs-empty
 * conventions: empty strings and empty arrays collapse to null.
 */

export const SITE = "https://apexhub-lime.vercel.app";

const nz = (v) => (v === "" || v === undefined ? null : v);
const nzArr = (v) => (Array.isArray(v) && v.length ? v : null);

/** ThreatScore weighting, matching the upstream severity-to-weight ladder. */
const WEIGHT = { critical: 1000, high: 100, medium: 10, low: 1, informational: 1 };
const RISK_LEVEL = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };

/** The four ThreatScore pillars. Every check declares one. */
export const PILLARS = {
  iam: "1. IAM",
  attacksurface: "2. Attack Surface",
  logging: "3. Logging and Monitoring",
  encryption: "4. Encryption",
};

/** Build the upstream-format metadata.json for a check. */
export function toMetadata(def, check) {
  const rem = check.remediation ?? {};
  return {
    Provider: def.id,
    CheckID: check.id,
    CheckTitle: check.title,
    CheckType: check.type ?? [],
    ServiceName: check.service,
    SubServiceName: check.subservice ?? "",
    ResourceIdTemplate: check.resourceIdTemplate ?? "",
    Severity: check.severity,
    ResourceType: check.resourceType ?? "NotDefined",
    ResourceGroup: check.resourceGroup ?? "",
    Description: check.description,
    Risk: check.risk,
    RelatedUrl: check.relatedUrl ?? "",
    AdditionalURLs: check.urls ?? [],
    Remediation: {
      Code: {
        CLI: rem.cli ?? "",
        NativeIaC: rem.nativeiac ?? "",
        Other: rem.other ?? "",
        Terraform: rem.terraform ?? "",
      },
      Recommendation: {
        Text: rem.text ?? "",
        Url: `${SITE}/check/${check.id}`,
      },
    },
    Categories: check.categories ?? [],
    DependsOn: check.dependsOn ?? [],
    RelatedTo: check.relatedTo ?? [],
    Notes: check.notes ?? "",
  };
}

/**
 * Build the hub Check object served by /api/check/{id}.
 *
 * @param complianceIds ids of the frameworks that reference this check.
 */
export function toHubCheck(def, check, complianceIds) {
  const rem = check.remediation ?? {};
  return {
    id: check.id,
    title: check.title,
    description: check.description,
    provider: def.id,
    type: check.type ?? [],
    service: check.service,
    subservice: nz(check.subservice),
    severity: check.severity,
    risk: check.risk,
    reference: null,
    additional_urls: check.urls ?? [],
    remediation: {
      cli: { description: rem.cli ?? "" },
      wui: { reference: `${SITE}/check/${check.id}`, description: rem.text ?? "" },
      other: { description: rem.other ?? "" },
      terraform: { description: rem.terraform ?? "" },
      nativeiac: { description: rem.nativeiac ?? "" },
    },
    services_required: [check.service],
    aws_arn_template: nz(check.resourceIdTemplate),
    notes: nz(check.notes),
    compliances: complianceIds.length
      ? complianceIds.map((id) => ({ id, name: FRAMEWORK_NAME }))
      : null,
    rational_estatement: null,
    remediation_procedure: null,
    audit_procedure: null,
    categories: check.categories ?? [],
    default_value: null,
    resource_type: check.resourceType ?? "NotDefined",
    related_url: nz(check.relatedUrl),
    depends_on: nzArr(check.dependsOn),
    related_to: nzArr(check.relatedTo),
    fixer: !!check.fixer,
  };
}

/** The compact index row backing search and the listing page. */
export function toIndexItem(def, check, complianceIds) {
  return {
    id: check.id,
    title: check.title,
    description: check.description,
    provider: def.id,
    type: check.type ?? [],
    service: check.service,
    subservice: nz(check.subservice),
    severity: check.severity,
    categories: check.categories ?? [],
    fixer: !!check.fixer,
    compliances: complianceIds,
  };
}

export const FRAMEWORK_NAME = "APEX HubThreatScore";

/**
 * Build the APEX Hub ThreatScore framework for a provider, grouping its checks
 * into the four ThreatScore pillars.
 */
export function toThreatScore(def) {
  const byPillar = new Map(Object.values(PILLARS).map((p) => [p, []]));
  for (const check of def.checks) {
    const pillar = PILLARS[check.pillar];
    if (!pillar) throw new Error(`${check.id}: unknown pillar "${check.pillar}"`);
    byPillar.get(pillar).push(check);
  }

  const requirements = [];
  let pillarNo = 0;
  for (const [section, checks] of byPillar) {
    pillarNo += 1;
    if (!checks.length) continue;
    checks.forEach((check, i) => {
      requirements.push({
        id: `${pillarNo}.1.${i + 1}`,
        checks: [check.id],
        attributes: [
          {
            title: check.title,
            weight: WEIGHT[check.severity] ?? 10,
            section,
            subsection: check.subsection ?? defaultSubsection(section),
            levelofrisk: RISK_LEVEL[check.severity] ?? 3,
            attributedescription: strip(check.description),
            additionalinformation: strip(check.risk),
          },
        ],
        description: check.title,
        total_checks: 1,
      });
    });
  }

  const id = `apexhub_threatscore_${def.id}`;
  return {
    id,
    name: `APEX Hub ThreatScore Compliance Framework for ${def.name}`,
    framework: FRAMEWORK_NAME,
    provider: def.id,
    description:
      def.threatscoreDescription ??
      `APEX Hub ThreatScore Compliance Framework for ${def.name} assesses the ${def.name} ` +
        `tenant across four pillars: Identity and Access Management, Attack Surface, ` +
        `Logging and Monitoring, and Encryption.`,
    requirements,
    version: "1.0",
    total_checks: requirements.length,
    total_requirements: requirements.length,
  };
}

/** Markdown emphasis is meaningless inside compliance attribute text. */
function strip(s) {
  return s.replace(/\*\*/g, "").replace(/`/g, "");
}

function defaultSubsection(section) {
  return {
    "1. IAM": "1.1 Authentication and Authorization",
    "2. Attack Surface": "2.1 Exposure",
    "3. Logging and Monitoring": "3.1 Audit Logging",
    "4. Encryption": "4.1 Data Protection",
  }[section];
}
