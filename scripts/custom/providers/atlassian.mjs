/** Atlassian Cloud — organization authentication, Jira and Confluence exposure. */

const organization_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Organization(AtlassianService):
    """Retrieve Atlassian organization authentication policies and domains."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[AtlassianOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            org_id = self.provider.identity.organization_id
            if not org_id:
                logger.info("Organization - No organization id configured.")
                return

            policies = self._paginate(
                f"/admin/v1/orgs/{org_id}/policies",
                "data",
                params={"type": "authentication-policy"},
            )
            domains = self._paginate(f"/admin/v1/orgs/{org_id}/domains", "data")
            org = self._get(f"/admin/v1/orgs/{org_id}") or {}
            attributes = (org.get("data") or {}).get("attributes") or {}

            self.organization = AtlassianOrganization(
                id=org_id,
                name=attributes.get("name", ""),
                data_residency_region=attributes.get("region"),
                byok_enabled=bool(attributes.get("byokEnabled", False)),
                verified_domains=[
                    (domain.get("attributes") or {}).get("name", "")
                    for domain in domains
                    if (domain.get("attributes") or {}).get("status") == "VERIFIED"
                ],
                authentication_policies=[
                    AtlassianAuthPolicy(
                        id=policy.get("id", ""),
                        name=(policy.get("attributes") or {}).get("name", ""),
                        status=(policy.get("attributes") or {}).get(
                            "status", "disabled"
                        ),
                        sso_enforced=bool(
                            ((policy.get("attributes") or {}).get("ssoEnforced"))
                        ),
                        two_step_required=bool(
                            ((policy.get("attributes") or {}).get(
                                "twoStepVerificationRequired"
                            ))
                        ),
                        api_token_access=str(
                            (policy.get("attributes") or {}).get(
                                "apiTokenAccess", "unrestricted"
                            )
                        ),
                        is_default=bool(
                            (policy.get("attributes") or {}).get("defaultPolicy", False)
                        ),
                    )
                    for policy in policies
                ],
            )
            self._get_audit_settings()
            logger.info(
                f"Organization - Read configuration for {self.organization.name or org_id}"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error reading organization configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_settings(self):
        """Confirm the organization audit log is readable."""
        if self.organization is None:
            return
        try:
            events = self._get(
                f"/admin/v1/orgs/{self.organization.id}/events",
                params={"limit": 1},
            )
            self.organization.audit_log_readable = events is not None
        except Exception as error:
            logger.error(
                f"Organization - Error reading audit log: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AtlassianAuthPolicy(BaseModel):
    """An Atlassian organization authentication policy."""

    id: str
    name: str = ""
    status: str = "disabled"
    sso_enforced: bool = False
    two_step_required: bool = False
    api_token_access: str = "unrestricted"
    is_default: bool = False


class AtlassianOrganization(BaseModel):
    """Atlassian organization representation."""

    id: str
    name: str = ""
    data_residency_region: Optional[str] = None
    byok_enabled: bool = False
    audit_log_readable: bool = False
    verified_domains: list[str] = Field(default_factory=list)
    authentication_policies: list[AtlassianAuthPolicy] = Field(default_factory=list)
`;

const jira_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Jira(AtlassianService):
    """Retrieve Jira projects with their permission scheme and anonymous access."""

    def __init__(self, provider):
        super().__init__("Jira", provider)
        self.projects: dict[str, JiraProject] = {}
        self._list_projects()
        self._get_global_permissions()

    def _list_projects(self):
        try:
            start_at = 0
            while True:
                data = self._get(
                    "/rest/api/3/project/search",
                    params={
                        "startAt": start_at,
                        "maxResults": 50,
                        "expand": "permissions,description",
                    },
                )
                if data is None:
                    break

                for raw in data.get("values", []):
                    project = JiraProject(
                        id=str(raw.get("id", "")),
                        key=raw.get("key", ""),
                        name=raw.get("name", ""),
                        project_type=raw.get("projectTypeKey", ""),
                        is_private=raw.get("isPrivate", True),
                    )
                    self.projects[project.key] = project

                if data.get("isLast", True):
                    break
                start_at += data.get("maxResults", 50)

            logger.info(f"Jira - Found {len(self.projects)} project(s)")
        except Exception as error:
            logger.error(
                f"Jira - Error listing projects: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_global_permissions(self):
        """Detect whether anonymous users hold any global Jira permission."""
        try:
            data = self._get("/rest/api/3/permissionscheme", params={
                "expand": "permissions,holder"
            }) or {}
            for scheme in data.get("permissionSchemes", []):
                for grant in (scheme.get("permissions") or []):
                    holder = grant.get("holder") or {}
                    if holder.get("type") != "anyone":
                        continue
                    for project in self.projects.values():
                        project.anonymous_grants.append(
                            grant.get("permission", "unknown")
                        )
        except Exception as error:
            logger.error(
                f"Jira - Error reading permission schemes: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JiraProject(BaseModel):
    """Jira project representation."""

    id: str
    key: str = ""
    name: str = ""
    project_type: str = ""
    is_private: bool = True
    anonymous_grants: list[str] = Field(default_factory=list)
`;

const confluence_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Confluence(AtlassianService):
    """Retrieve Confluence spaces with their permission and anonymous access state."""

    def __init__(self, provider):
        super().__init__("Confluence", provider)
        self.spaces: dict[str, ConfluenceSpace] = {}
        self._list_spaces()
        self.__threading_call__(self._get_space_permissions, list(self.spaces.values()))

    def _list_spaces(self):
        try:
            cursor = None
            while True:
                params = {"limit": 100}
                if cursor:
                    params["cursor"] = cursor

                data = self._get("/wiki/api/v2/spaces", params=params)
                if data is None:
                    break

                for raw in data.get("results", []):
                    space = ConfluenceSpace(
                        id=str(raw.get("id", "")),
                        key=raw.get("key", ""),
                        name=raw.get("name", ""),
                        space_type=raw.get("type", "global"),
                        status=raw.get("status", "current"),
                    )
                    self.spaces[space.key] = space

                cursor = ((data.get("_links") or {}).get("next") or "").split(
                    "cursor="
                )[-1] or None
                if not cursor or "cursor=" not in ((data.get("_links") or {}).get("next") or ""):
                    break

            logger.info(f"Confluence - Found {len(self.spaces)} space(s)")
        except Exception as error:
            logger.error(
                f"Confluence - Error listing spaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_space_permissions(self, space: "ConfluenceSpace"):
        try:
            data = self._get(
                f"/wiki/api/v2/spaces/{space.id}/permissions",
                params={"limit": 250},
            )
            if data is None:
                return

            for raw in data.get("results", []):
                principal = raw.get("principal") or {}
                operation = raw.get("operation") or {}
                if principal.get("type") in ("anonymous", "unknown"):
                    space.anonymous_permissions.append(
                        f"{operation.get('key', '')}:{operation.get('targetType', '')}"
                    )
        except Exception as error:
            logger.error(
                f"Confluence - Error fetching permissions for {space.key}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class ConfluenceSpace(BaseModel):
    """Confluence space representation."""

    id: str
    key: str = ""
    name: str = ""
    space_type: str = "global"
    status: str = "current"
    anonymous_permissions: list[str] = Field(default_factory=list)
`;

export default {
  id: "atlassian",
  name: "Atlassian Cloud",
  pyClass: "Atlassian",
  baseUrl: "https://api.atlassian.com",
  samplePath: "/admin/v1/orgs",
  errorCodeBase: 15000,
  pageParam: "cursor",
  pageSizeParam: "limit",
  pageSize: 100,
  credentialsRemediation:
    "Set ATLASSIAN_ORG_ID, ATLASSIAN_SITE_URL and ATLASSIAN_TOKEN to an organization API key created under Atlassian Administration > Settings > API keys.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Atlassian Cloud assesses an Atlassian organization together with its Jira and Confluence products across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers authentication policy coverage, SSO and two-step verification enforcement, API token restriction, anonymous access to projects and spaces, audit logging and bring-your-own-key encryption.",

  services: {
    organization: { pyClass: "Organization", source: organization_service },
    jira: { pyClass: "Jira", source: jira_service },
    confluence: { pyClass: "Confluence", source: confluence_service },
  },

  checks: [
    {
      id: "atlassian_organization_authentication_policy_enforces_sso",
      service: "organization",
      pillar: "iam",
      severity: "critical",
      title: "Atlassian organizations enforce SSO through an authentication policy",
      resourceType: "Atlassian::Organization::AuthenticationPolicy",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the organization has verified at least one domain and that its **default authentication policy** enforces SSO, so every managed account signs in through the corporate identity provider.",
      risk:
        "Atlassian authentication policies only apply to **managed accounts on verified domains** — accounts outside that boundary keep signing in with Atlassian passwords no matter what the policy says. Since Jira and Confluence hold vulnerability tickets, incident records, runbooks and architecture documentation, an account outside the policy is an unmonitored route into the organisation's internal knowledge base.",
      urls: [
        "https://support.atlassian.com/security-and-access-policies/docs/understand-authentication-policies/",
        "https://developer.atlassian.com/cloud/admin/organization/rest/",
      ],
      relatedTo: ["atlassian_organization_two_step_verification_required"],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $ATLASSIAN_TOKEN\" \\\n  \"https://api.atlassian.com/admin/v1/orgs/$ATLASSIAN_ORG_ID/policies?type=authentication-policy\"",
        other:
          "1. In Atlassian Administration, go to **Security > Domains** and verify every domain your organisation uses\n2. Claim the accounts on those domains so they become managed\n3. Go to **Security > Authentication policies**\n4. Edit the default policy and enable **Enforce single sign-on**\n5. Verify that no members are left in a non-enforcing policy\n6. Configure SCIM user provisioning so deactivation in the IdP removes Atlassian access automatically",
        terraform: "",
        text:
          "Verify all your domains, claim the accounts on them, enforce SSO in the default authentication policy, and add SCIM provisioning so deprovisioning is automatic.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAtlassian(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if not organization.verified_domains:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has no verified "
        f"domain, so authentication policies govern no accounts."
    )
    findings.append(report)
    return findings

non_enforcing = [
    policy
    for policy in organization.authentication_policies
    if policy.status.lower() == "enabled" and not policy.sso_enforced
]
enforcing = [
    policy for policy in organization.authentication_policies if policy.sso_enforced
]

if enforcing and not non_enforcing:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} enforces SSO across "
        f"{len(enforcing)} authentication policy(ies) covering "
        f"{len(organization.verified_domains)} verified domain(s)."
    )
elif enforcing:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} enforces SSO in some "
        f"policies but {len(non_enforcing)} enabled policy(ies) do not: "
        f"{', '.join(policy.name or policy.id for policy in non_enforcing)}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has no "
        f"authentication policy enforcing SSO."
    )

findings.append(report)
return findings`,
    },

    {
      id: "atlassian_organization_two_step_verification_required",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "Atlassian authentication policies require two-step verification",
      resourceType: "Atlassian::Organization::AuthenticationPolicy",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that every enabled authentication policy requires **two-step verification**, covering the accounts that sign in with an Atlassian password rather than through SSO.",
      risk:
        "Where SSO is not enforced for a policy, the accounts it covers are protected by **a password alone against an internet-facing login endpoint**. Atlassian credentials are heavily targeted precisely because Jira and Confluence describe the organisation's systems, unpatched vulnerabilities and operational procedures in detail — valuable reconnaissance for a follow-on intrusion.",
      urls: [
        "https://support.atlassian.com/security-and-access-policies/docs/manage-two-step-verification/",
        "https://developer.atlassian.com/cloud/admin/organization/rest/",
      ],
      relatedTo: ["atlassian_organization_authentication_policy_enforces_sso"],
      remediation: {
        cli: "",
        other:
          "1. In Atlassian Administration, go to **Security > Authentication policies**\n2. Edit each enabled policy\n3. Enable **Require two-step verification**\n4. Notify affected members before enforcing, since those without it enrolled lose access\n5. Where a policy enforces SSO instead, apply the equivalent requirement in the identity provider\n6. Keep one break-glass administrator account documented and monitored",
        terraform: "",
        text:
          "Require two-step verification in every enabled authentication policy, or enforce the equivalent in your IdP where the policy uses SSO, keeping a documented break-glass account.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

for policy in organization.authentication_policies:
    if policy.status.lower() != "enabled":
        continue

    report = CheckReportAtlassian(
        metadata=self.metadata(),
        resource=policy,
        resource_name=policy.name or policy.id,
        resource_id=policy.id,
    )

    # SSO delegates the factor policy to the identity provider.
    if policy.two_step_required or policy.sso_enforced:
        report.status = "PASS"
        report.status_extended = (
            f"Authentication policy {policy.name or policy.id} requires two-step "
            f"verification"
            f"{' through the federated identity provider' if not policy.two_step_required else ''}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Authentication policy {policy.name or policy.id} does not require "
            f"two-step verification."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "atlassian_organization_api_token_access_restricted",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "Atlassian authentication policies restrict API token creation",
      resourceType: "Atlassian::Organization::AuthenticationPolicy",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check verifies that authentication policies restrict or block **API token** creation, rather than allowing every managed account to mint tokens without oversight.",
      risk:
        "An Atlassian API token **bypasses SSO and two-step verification entirely** — it is a bearer credential that authenticates directly to the REST API with the user's full permissions. That makes unrestricted token creation a standing hole in whatever authentication policy you have configured, and tokens created by a user persist after their session is revoked.",
      urls: [
        "https://support.atlassian.com/organization-administration/docs/manage-api-tokens-for-your-organization/",
        "https://support.atlassian.com/security-and-access-policies/docs/understand-authentication-policies/",
      ],
      relatedTo: ["atlassian_organization_authentication_policy_enforces_sso"],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $ATLASSIAN_TOKEN\" \\\n  \"https://api.atlassian.com/admin/v1/orgs/$ATLASSIAN_ORG_ID/policies?type=authentication-policy\"",
        other:
          "1. In Atlassian Administration, go to **Security > Authentication policies**\n2. Edit each policy and set **API token access** to blocked, or restricted to tokens with an expiry\n3. Review existing tokens under **Security > API tokens** and revoke those that are unused or unattributed\n4. Move integrations to OAuth 2.0 apps or Connect apps, which can be scoped and revoked centrally\n5. Where tokens remain necessary, require a short maximum expiry and rotate on a schedule",
        terraform: "",
        text:
          "Block or restrict API token creation in every authentication policy, revoke unattributed tokens, and move integrations to scoped OAuth apps that can be revoked centrally.",
      },
      body: `RESTRICTED = {"blocked", "restricted", "disabled", "expiry_required"}

findings = []
organization = organization_client.organization
if organization is None:
    return findings

for policy in organization.authentication_policies:
    if policy.status.lower() != "enabled":
        continue

    report = CheckReportAtlassian(
        metadata=self.metadata(),
        resource=policy,
        resource_name=policy.name or policy.id,
        resource_id=policy.id,
    )

    access = (policy.api_token_access or "unrestricted").lower()

    if access in RESTRICTED:
        report.status = "PASS"
        report.status_extended = (
            f"Authentication policy {policy.name or policy.id} sets API token "
            f"access to '{access}'."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Authentication policy {policy.name or policy.id} allows unrestricted "
            f"API token creation, which bypasses SSO and two-step verification."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "atlassian_jira_no_anonymous_access",
      service: "jira",
      pillar: "attacksurface",
      severity: "high",
      title: "Jira projects grant no permissions to anonymous users",
      resourceType: "Atlassian::Jira::Project",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "This check reports Jira projects covered by a permission scheme that grants any permission to the **Anyone** (anonymous) holder, which makes issues readable without authentication.",
      risk:
        "Anonymous Jira access exposes the **issue tracker to the internet**, and issue tracking is where organisations record unpatched vulnerabilities, internal hostnames, credentials pasted into comments and the exact sequence of steps that reproduce a bug. Attackers actively search for open Jira instances precisely because they describe the target's weaknesses in the defenders' own words.",
      urls: [
        "https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/",
        "https://confluence.atlassian.com/jira/jira-security-advisories",
      ],
      relatedTo: ["atlassian_confluence_no_anonymous_access"],
      remediation: {
        cli: "",
        other:
          "1. In Jira, go to **Settings > Issues > Permission schemes**\n2. Review each scheme for grants to the **Anyone** holder\n3. Remove those grants, replacing them with a specific group or project role\n4. Check **Settings > System > Global permissions** for anonymous grants such as Browse Users\n5. If a project must be public, move it to a dedicated site with no internal data and confirm attachments are reviewed\n6. Search existing issues for credentials before and after making a project private, since anything exposed should be treated as leaked",
        terraform: "",
        text:
          "Remove Anyone grants from permission schemes and global permissions, isolate genuinely public projects to a separate site, and treat anything previously exposed as leaked.",
      },
      body: `findings = []
for project in jira_client.projects.values():
    report = CheckReportAtlassian(
        metadata=self.metadata(),
        resource=project,
        resource_name=f"{project.key} ({project.name})",
        resource_id=project.id,
    )

    if project.anonymous_grants:
        unique_grants = sorted(set(project.anonymous_grants))
        report.status = "FAIL"
        report.status_extended = (
            f"Jira project {project.key} grants {len(unique_grants)} permission(s) "
            f"to anonymous users: {', '.join(unique_grants)}."
        )
    elif not project.is_private:
        report.status = "FAIL"
        report.status_extended = (
            f"Jira project {project.key} is not marked private."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Jira project {project.key} grants no permissions to anonymous users."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "atlassian_confluence_no_anonymous_access",
      service: "confluence",
      pillar: "attacksurface",
      severity: "high",
      title: "Confluence spaces grant no permissions to anonymous users",
      resourceType: "Atlassian::Confluence::Space",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "This check reports Confluence spaces that grant any permission to the **anonymous** principal, making their pages readable without authentication.",
      risk:
        "Confluence is where organisations keep **runbooks, architecture diagrams, onboarding guides and credentials pasted 'temporarily' into a setup page**. An anonymously readable space therefore hands an attacker a curated map of your systems and, frequently, working credentials — with no exploitation required and no authentication event to detect.",
      urls: [
        "https://support.atlassian.com/confluence-cloud/docs/assign-space-permissions/",
        "https://support.atlassian.com/confluence-cloud/docs/set-up-public-access/",
      ],
      relatedTo: ["atlassian_jira_no_anonymous_access"],
      remediation: {
        cli: "",
        other:
          "1. In Confluence, go to **Space settings > Permissions** for each space\n2. Remove all permissions granted to **Anonymous**\n3. Disable anonymous access globally under **Settings > Security > Anonymous access** unless a public space is genuinely required\n4. Search the exposed spaces for credentials, tokens and internal hostnames\n5. Rotate anything found — treat it as public regardless of how briefly the space was exposed\n6. Where public documentation is needed, publish it from a separate site rather than the internal instance",
        terraform: "",
        text:
          "Remove anonymous permissions from every space, disable anonymous access globally, search exposed spaces for credentials and rotate what you find, and publish public docs from a separate site.",
      },
      body: `findings = []
for space in confluence_client.spaces.values():
    if space.status != "current":
        continue

    report = CheckReportAtlassian(
        metadata=self.metadata(),
        resource=space,
        resource_name=f"{space.key} ({space.name})",
        resource_id=space.id,
    )

    if space.anonymous_permissions:
        unique = sorted(set(space.anonymous_permissions))
        report.status = "FAIL"
        report.status_extended = (
            f"Confluence space {space.key} grants {len(unique)} permission(s) to "
            f"anonymous users: {', '.join(unique)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Confluence space {space.key} grants no permissions to anonymous "
            f"users."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "atlassian_organization_audit_log_accessible",
      service: "organization",
      pillar: "logging",
      severity: "medium",
      title: "Atlassian organizations have an accessible audit log",
      resourceType: "Atlassian::Organization::AuditLog",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "This check verifies that the organization's **events API** is readable, indicating that administrative and product access events can be exported to a SIEM.",
      risk:
        "Without exported organization events there is **no durable record of policy changes, product access grants, API token creation or account claims**. Those are the actions an attacker takes to establish persistence in Atlassian Cloud, and the in-product view is both time-limited and visible only to the same administrators whose actions it records.",
      urls: [
        "https://support.atlassian.com/organization-administration/docs/track-organization-activities-from-the-audit-log/",
        "https://developer.atlassian.com/cloud/admin/organization/rest/",
      ],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $ATLASSIAN_TOKEN\" \\\n  \"https://api.atlassian.com/admin/v1/orgs/$ATLASSIAN_ORG_ID/events?limit=100\"",
        other:
          "1. Confirm your plan includes the organization audit log\n2. Create an organization API key with the scope to read events\n3. Build a scheduled pull of `/admin/v1/orgs/{orgId}/events` into your SIEM\n4. Alert on authentication policy changes, API token creation, product access grants and domain claim events\n5. Retain exported events for at least your investigation window\n6. Review the product-level audit logs in Jira and Confluence as well, which record different events",
        terraform: "",
        text:
          "Export organization events into your SIEM on a schedule, alert on policy changes and token creation, and remember the product-level Jira and Confluence audit logs record separate events.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAtlassian(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.audit_log_readable:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has a readable audit "
        f"log available for export."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} audit log is not "
        f"readable; administrative events cannot be exported."
    )

findings.append(report)
return findings`,
    },

    {
      id: "atlassian_organization_byok_encryption_enabled",
      service: "organization",
      pillar: "encryption",
      severity: "low",
      title: "Atlassian organizations use bring-your-own-key encryption",
      resourceType: "Atlassian::Organization",
      resourceGroup: "storage",
      categories: ["encryption", "data-protection"],
      description:
        "**Bring Your Own Key** encrypts Atlassian product data with a key held in your own AWS KMS. This check verifies that BYOK is enabled, and reports organizations with no configured data residency region.",
      risk:
        "With provider-managed keys only, you have **no independent means of revoking access to your Jira and Confluence data** during a suspected platform compromise — containment depends entirely on the provider. An unset residency region additionally means data may be stored outside the jurisdiction your regulatory commitments assume.",
      urls: [
        "https://support.atlassian.com/security-and-access-policies/docs/manage-your-own-encryption-keys/",
        "https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Confirm your plan includes BYOK (Atlassian Cloud Enterprise)\n2. Create a KMS key in your own AWS account in a supported region\n3. Grant Atlassian the minimum key usage permissions required\n4. Enable BYOK in Atlassian Administration under **Security > Data encryption**\n5. Set the **data residency** region for each product to match your regulatory commitments\n6. Enable key rotation and monitor key usage in CloudTrail\n7. Document the revocation runbook, including what becomes inaccessible and to whom",
        terraform: "",
        text:
          "Enable BYOK with a key in your own KMS, pin the data residency region to your regulatory jurisdiction, monitor key usage in CloudTrail, and document a revocation runbook.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAtlassian(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.byok_enabled:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} encrypts product "
        f"data with a customer-managed key."
    )
    if not organization.data_residency_region:
        report.status_extended += " No data residency region is pinned."
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} does not use "
        f"bring-your-own-key encryption"
        f"{' and has no data residency region pinned' if not organization.data_residency_region else ''}."
    )

findings.append(report)
return findings`,
    },
  ],
};
