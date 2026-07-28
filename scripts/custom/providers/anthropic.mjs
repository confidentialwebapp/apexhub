/** Anthropic Console — organization, workspace and API key configuration posture. */

const organization_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class Organization(AnthropicService):
    """Retrieve Anthropic organization members, invites and security settings."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[AnthropicOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            members = self._paginate("/v1/organizations/users", "data")
            invites = self._paginate("/v1/organizations/invites", "data")
            settings = self._get("/v1/organizations/settings") or {}

            self.organization = AnthropicOrganization(
                id=self.provider.identity.organization_id or "",
                name=self.provider.identity.organization_name or "",
                sso_enforced=bool(settings.get("sso_enforced", False)),
                mfa_required=bool(settings.get("mfa_required", False)),
                domain_verified=bool(settings.get("domain_verified", False)),
                scim_enabled=bool(settings.get("scim_enabled", False)),
                zero_data_retention=bool(settings.get("zero_data_retention", False)),
                audit_log_export_configured=bool(
                    settings.get("audit_log_export_enabled", False)
                ),
                members=[
                    AnthropicMember(
                        id=raw.get("id", ""),
                        email=raw.get("email", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "user"),
                        added_at=raw.get("added_at"),
                    )
                    for raw in members
                ],
                pending_invites=[
                    raw.get("email", "")
                    for raw in invites
                    if raw.get("status") == "pending"
                ],
            )
            logger.info(
                f"Organization - Read configuration for "
                f"{self.organization.name or self.organization.id}"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error reading organization configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AnthropicMember(BaseModel):
    """A member of an Anthropic organization."""

    id: str
    email: str = ""
    name: str = ""
    role: str = "user"
    added_at: Optional[str] = None


class AnthropicOrganization(BaseModel):
    """Anthropic organization representation."""

    id: str
    name: str = ""
    sso_enforced: bool = False
    mfa_required: bool = False
    domain_verified: bool = False
    scim_enabled: bool = False
    zero_data_retention: bool = False
    audit_log_export_configured: bool = False
    members: list[AnthropicMember] = Field(default_factory=list)
    pending_invites: list[str] = Field(default_factory=list)
`;

const workspace_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class Workspace(AnthropicService):
    """Retrieve Anthropic workspaces with their spend limits and member roles."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, AnthropicWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_members, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for raw in self._paginate("/v1/organizations/workspaces", "data"):
                workspace = AnthropicWorkspace(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    archived_at=raw.get("archived_at"),
                    spend_limit_usd=_as_float(raw.get("spend_limit")),
                    rate_limit_configured=bool(raw.get("rate_limit")),
                    created_at=raw.get("created_at"),
                )
                self.workspaces[workspace.id] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_members(self, workspace: "AnthropicWorkspace"):
        try:
            for raw in (
                self._paginate(
                    f"/v1/organizations/workspaces/{workspace.id}/members", "data"
                )
                or []
            ):
                workspace.members.append(
                    AnthropicWorkspaceMember(
                        user_id=raw.get("user_id", ""),
                        role=raw.get("workspace_role", "workspace_user"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching members for {workspace.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_float(value) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class AnthropicWorkspaceMember(BaseModel):
    """A member assignment within an Anthropic workspace."""

    user_id: str
    role: str = "workspace_user"


class AnthropicWorkspace(BaseModel):
    """Anthropic workspace representation."""

    id: str
    name: str = ""
    archived_at: Optional[str] = None
    spend_limit_usd: Optional[float] = None
    rate_limit_configured: bool = False
    created_at: Optional[str] = None
    members: list[AnthropicWorkspaceMember] = Field(default_factory=list)
`;

const apikey_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class ApiKey(AnthropicService):
    """Retrieve Anthropic API keys with workspace scope, status and age."""

    def __init__(self, provider):
        super().__init__("ApiKey", provider)
        self.keys: dict[str, AnthropicApiKey] = {}
        self._list_keys()

    def _list_keys(self):
        try:
            for raw in self._paginate("/v1/organizations/api_keys", "data"):
                key = AnthropicApiKey(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    status=raw.get("status", "active"),
                    workspace_id=raw.get("workspace_id"),
                    created_at=raw.get("created_at"),
                    created_by=(raw.get("created_by") or {}).get("id", ""),
                    partial_key_hint=raw.get("partial_key_hint", ""),
                )
                self.keys[key.id] = key
            logger.info(f"ApiKey - Found {len(self.keys)} API key(s)")
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AnthropicApiKey(BaseModel):
    """Anthropic API key representation."""

    id: str
    name: str = ""
    status: str = "active"
    workspace_id: Optional[str] = None
    created_at: Optional[str] = None
    created_by: str = ""
    partial_key_hint: str = ""
`;

export default {
  id: "anthropic",
  name: "Anthropic Console",
  pyClass: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  samplePath: "/v1/organizations/workspaces",
  errorCodeBase: 14600,
  pageParam: "after_id",
  pageSizeParam: "limit",
  pageSize: 100,
  auth: { header: "x-api-key", scheme: null },
  credentialsRemediation:
    "Set ANTHROPIC_ADMIN_KEY to an Admin API key created under Console > Settings > Admin keys. Standard API keys cannot read organization or workspace configuration.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for the Anthropic Console assesses an Anthropic organization across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers console authentication, workspace isolation, API key scoping and rotation, spend limits and data retention — the controls that govern who can consume your model capacity and what leaves your environment in a prompt.",

  services: {
    organization: { pyClass: "Organization", source: organization_service },
    workspace: { pyClass: "Workspace", source: workspace_service },
    apikey: { pyClass: "ApiKey", source: apikey_service },
  },

  checks: [
    {
      id: "anthropic_organization_sso_enforced",
      service: "organization",
      pillar: "iam",
      severity: "critical",
      title: "Anthropic organizations enforce SSO with a verified domain",
      resourceType: "Anthropic::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the Anthropic organization enforces **single sign-on** against a verified domain, so console membership is governed by the corporate identity provider and removed automatically when someone leaves.",
      risk:
        "Console access is what creates and reads **API keys**, so a member signing in with a personal credential holds an unmanaged path to your model capacity. Without federation there is no conditional access, no central session revocation and no automatic deprovisioning, so a departing employee's access persists until a manual step nobody owns is completed.",
      urls: [
        "https://support.anthropic.com/en/collections/4078531-claude-for-work",
        "https://docs.claude.com/en/api/administration-api",
      ],
      relatedTo: ["anthropic_organization_mfa_required"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to the Anthropic Console as an organization admin\n2. Go to **Settings > Security**\n3. Verify your email domain using the supplied DNS record\n4. Configure the SAML connection to your identity provider\n5. Enable SCIM provisioning so membership follows the IdP automatically\n6. Test with a pilot user, then enforce SSO for all members\n7. Remove accounts using personal email addresses once federation is proven",
        terraform: "",
        text:
          "Verify your domain, federate console sign-in through SAML, and enable SCIM so membership and deprovisioning follow your identity provider rather than manual review.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAnthropic(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.sso_enforced and organization.domain_verified:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} enforces SSO with a "
        f"verified domain."
    )
    if not organization.scim_enabled:
        report.status_extended += " SCIM provisioning is not enabled."
elif organization.sso_enforced:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} enforces SSO but has "
        f"no verified domain."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} does not enforce SSO."
    )

findings.append(report)
return findings`,
    },

    {
      id: "anthropic_organization_mfa_required",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "Anthropic organizations require multi-factor authentication",
      resourceType: "Anthropic::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that console sign-in requires **multi-factor authentication**, either enforced in the Anthropic Console or upstream in the federated identity provider.",
      risk:
        "A password-only console account gives an attacker the ability to **mint API keys and add workspace members**, establishing persistence that survives a password reset. Because usage is metered, a compromised organization also produces immediate financial loss and exposes whatever data the organization's prompts carry.",
      urls: [
        "https://support.anthropic.com/en/collections/4078531-claude-for-work",
        "https://docs.claude.com/en/api/administration-api",
      ],
      relatedTo: ["anthropic_organization_sso_enforced"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to the Anthropic Console as an organization admin\n2. Go to **Settings > Security**\n3. Enable the multi-factor authentication requirement\n4. Where sign-in is federated, enforce MFA in the identity provider's conditional access policy so it applies consistently\n5. Prefer phishing-resistant factors (WebAuthn/passkeys) over one-time codes\n6. Verify that all existing members have enrolled",
        terraform: "",
        text:
          "Require multi-factor authentication for console access, preferring phishing-resistant factors, and enforce it in your identity provider when sign-in is federated.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAnthropic(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

# SSO delegates the factor policy to the identity provider.
if organization.mfa_required or organization.sso_enforced:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} requires "
        f"multi-factor authentication"
        f"{' through the federated identity provider' if not organization.mfa_required else ''}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} does not require "
        f"multi-factor authentication."
    )

findings.append(report)
return findings`,
    },

    {
      id: "anthropic_organization_admin_role_limited",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "Anthropic organizations limit the number of admin members",
      resourceType: "Anthropic::Organization::Member",
      resourceGroup: "iam",
      categories: ["authentication", "trust-boundaries"],
      description:
        "Organization **admins** can create API keys, manage workspaces and change billing. This check reports organizations where the admin count exceeds the configured threshold, or where more than half of all members hold the role.",
      risk:
        "Every additional admin is another account whose compromise yields **full control of the organization**, including the ability to issue keys that outlive the intrusion. Admin roles granted for a one-off task and never revoked are the usual cause, and because the console is used infrequently, the excess grants are rarely noticed.",
      urls: [
        "https://docs.claude.com/en/api/administration-api",
        "https://support.anthropic.com/en/collections/4078531-claude-for-work",
      ],
      remediation: {
        cli: "curl https://api.anthropic.com/v1/organizations/users \\\n  -H \"x-api-key: $ANTHROPIC_ADMIN_KEY\" \\\n  -H \"anthropic-version: 2023-06-01\"",
        other:
          "1. List organization members and their roles\n2. Identify who genuinely needs to manage keys, workspaces and billing\n3. Demote the rest to the developer or user role\n4. Use **workspace-scoped roles** to grant project-level control without organization-wide admin\n5. Record the expected admin set and review it on a recurring schedule\n6. Ensure every remaining admin is covered by SSO and MFA",
        terraform: "",
        text:
          "Keep organization admin to a small named set, use workspace-scoped roles for project-level control, and review the admin list on a recurring schedule.",
      },
      body: `max_admins = self.audit_config.get("max_organization_admins", 3)

findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAnthropic(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

admins = [member for member in organization.members if member.role == "admin"]
total = len(organization.members)

if not organization.members:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} membership could not "
        f"be read; confirm the admin key has organization read scope."
    )
elif len(admins) <= max_admins and len(admins) * 2 <= total:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has {len(admins)} "
        f"admin(s) out of {total} member(s)."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has {len(admins)} "
        f"admin(s) out of {total} member(s), above the threshold of {max_admins}."
    )

findings.append(report)
return findings`,
    },

    {
      id: "anthropic_organization_audit_log_export_configured",
      service: "organization",
      pillar: "logging",
      severity: "medium",
      title: "Anthropic organizations export audit logs to an external system",
      resourceType: "Anthropic::Organization::AuditLog",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "This check verifies that organization audit events — key creation, member changes and workspace configuration — are exported to a system outside the Anthropic Console.",
      risk:
        "API key creation is the event that matters most in this platform, and without an external export there is **no durable, independently held record** of who created which key. An attacker who reaches admin can mint a key and, with no exported trail, the organization cannot later establish when the access was granted or which keys to consider compromised.",
      urls: [
        "https://docs.claude.com/en/api/administration-api",
        "https://support.anthropic.com/en/collections/4078531-claude-for-work",
      ],
      remediation: {
        cli: "curl https://api.anthropic.com/v1/organizations/api_keys \\\n  -H \"x-api-key: $ANTHROPIC_ADMIN_KEY\" \\\n  -H \"anthropic-version: 2023-06-01\"",
        other:
          "1. Confirm your plan includes audit log access\n2. Configure the export, or build a scheduled job that pulls organization events into your SIEM\n3. Alert on API key creation, admin role grants and workspace creation\n4. Retain exported records for at least your incident investigation window\n5. Reconcile the exported key inventory against your secrets manager periodically so unmanaged keys surface",
        terraform: "",
        text:
          "Export organization audit events into your SIEM, alert on key creation and admin grants, and periodically reconcile the key inventory against your secrets manager.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAnthropic(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.audit_log_export_configured:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} exports audit logs "
        f"to an external system."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} does not export "
        f"audit logs to an external system."
    )

findings.append(report)
return findings`,
    },

    {
      id: "anthropic_workspace_spend_limit_configured",
      service: "workspace",
      pillar: "attacksurface",
      severity: "medium",
      title: "Anthropic workspaces define a spend limit",
      resourceType: "Anthropic::Workspace",
      resourceGroup: "compute",
      categories: ["resilience"],
      description:
        "A workspace **spend limit** caps how much a workspace's keys may consume. This check reports active workspaces with no limit configured, which leaves a single leaked key able to draw against the whole organization's budget.",
      risk:
        "An uncapped workspace turns a leaked API key directly into **unbounded financial loss**, and heavy abuse traffic also consumes the rate capacity your production workloads depend on. A per-workspace limit converts both into a bounded, self-announcing failure: spend stops and the anomaly becomes visible.",
      urls: [
        "https://docs.claude.com/en/api/rate-limits",
        "https://docs.claude.com/en/api/administration-api",
      ],
      relatedTo: ["anthropic_apikey_scoped_to_workspace"],
      remediation: {
        cli: "curl https://api.anthropic.com/v1/organizations/workspaces \\\n  -H \"x-api-key: $ANTHROPIC_ADMIN_KEY\" \\\n  -H \"anthropic-version: 2023-06-01\"",
        other:
          "1. Open the workspace in the Anthropic Console\n2. Set a monthly spend limit sized to the workload's expected usage plus headroom\n3. Configure notification thresholds below the hard limit so the team is warned before traffic stops\n4. Give each workload its own workspace so limits are meaningful\n5. Review limits when traffic patterns change rather than raising them reactively during an incident",
        terraform: "",
        text:
          "Set a monthly spend limit and warning threshold on every active workspace, sized per workload, so a leaked key produces a bounded and visible failure.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    if workspace.archived_at:
        continue

    report = CheckReportAnthropic(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=workspace.name or workspace.id,
        resource_id=workspace.id,
    )

    limit = workspace.spend_limit_usd

    if limit is not None and limit > 0:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.name or workspace.id} has a spend limit of "
            f"{limit:.2f} USD."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name or workspace.id} has no spend limit "
            f"configured."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "anthropic_apikey_scoped_to_workspace",
      service: "apikey",
      alsoUses: ["workspace"],
      pillar: "iam",
      severity: "high",
      title: "Anthropic API keys are scoped to a workspace",
      resourceType: "Anthropic::ApiKey",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "Workspace-scoped API keys inherit that workspace's spend limit, rate limit and member boundary. This check reports active keys attached to the **default workspace** or to no workspace at all, which places them outside those controls.",
      risk:
        "A key that is not workspace-scoped draws against the **organization's shared limits**, so its compromise degrades every other workload rather than only its own. It also loses the isolation that makes revocation safe: without a workspace boundary, there is no way to disable one workload's access without assessing the impact on all of them.",
      urls: [
        "https://docs.claude.com/en/api/administration-api",
        "https://docs.claude.com/en/api/rate-limits",
      ],
      relatedTo: ["anthropic_workspace_spend_limit_configured", "anthropic_apikey_rotated"],
      remediation: {
        cli: "curl https://api.anthropic.com/v1/organizations/api_keys \\\n  -H \"x-api-key: $ANTHROPIC_ADMIN_KEY\" \\\n  -H \"anthropic-version: 2023-06-01\"",
        other:
          "1. Create a workspace for each workload in the Anthropic Console\n2. Issue a new API key inside that workspace\n3. Deploy the new key and verify traffic has moved\n4. Deactivate the unscoped key it replaced\n5. Set spend and rate limits on each workspace so the scope carries a real boundary\n6. Keep the default workspace empty so anything appearing in it is visibly an exception",
        terraform: "",
        text:
          "Give each workload its own workspace and issue keys inside it, keeping the default workspace empty so unscoped keys stand out as exceptions.",
      },
      body: `findings = []
for key in apikey_client.keys.values():
    if key.status != "active":
        continue

    report = CheckReportAnthropic(
        metadata=self.metadata(),
        resource=key,
        resource_name=key.name or key.id,
        resource_id=key.id,
    )

    workspace = (
        workspace_client.workspaces.get(key.workspace_id)
        if key.workspace_id
        else None
    )

    if key.workspace_id and workspace is not None:
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.name or key.id} is scoped to workspace "
            f"{workspace.name or key.workspace_id}."
        )
    elif key.workspace_id:
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.name or key.id} is scoped to workspace "
            f"{key.workspace_id}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} is not scoped to a workspace and draws "
            f"against organization-wide limits."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "anthropic_apikey_rotated",
      service: "apikey",
      pillar: "iam",
      severity: "medium",
      title: "Anthropic API keys are rotated and inactive keys are removed",
      resourceType: "Anthropic::ApiKey",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check reports active API keys older than the configured maximum age (365 days by default), and inactive keys left in the organization rather than deleted.",
      risk:
        "Anthropic API keys **do not expire**, so a key committed to a repository or pasted into a chat stays valid until someone deletes it. Long-lived keys also accumulate copies across environments, which means a single rotation event cannot reliably retire the exposure — the only durable fix is a rotation schedule short enough to bound how long a leak remains useful.",
      urls: [
        "https://docs.claude.com/en/api/administration-api",
        "https://docs.claude.com/en/docs/initial-setup",
      ],
      relatedTo: ["anthropic_apikey_scoped_to_workspace"],
      remediation: {
        cli: "curl -X POST https://api.anthropic.com/v1/organizations/api_keys/<key-id> \\\n  -H \"x-api-key: $ANTHROPIC_ADMIN_KEY\" \\\n  -H \"anthropic-version: 2023-06-01\" \\\n  -H 'content-type: application/json' \\\n  -d '{\"status\":\"inactive\"}'",
        other:
          "1. List organization API keys and note their creation dates\n2. For each key past your rotation window: create a replacement in the same workspace\n3. Deploy the replacement and confirm traffic has moved\n4. Set the old key to inactive, wait for the observation window, then delete it\n5. Store keys in a secrets manager rather than environment files in source control\n6. Alert on unexpected spend so a leaked key is detected between rotations",
        terraform: "",
        text:
          "Rotate API keys on a fixed schedule using a create-deploy-deactivate-delete sequence, store them in a secrets manager, and alert on spend anomalies to catch leaks between rotations.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_age_days = self.audit_config.get("max_api_key_age_days", 365)
cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

findings = []
for key in apikey_client.keys.values():
    report = CheckReportAnthropic(
        metadata=self.metadata(),
        resource=key,
        resource_name=key.name or key.id,
        resource_id=key.id,
    )

    if key.status != "active":
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} has status '{key.status}' but has not "
            f"been deleted from the organization."
        )
        findings.append(report)
        continue

    created = None
    if key.created_at:
        try:
            created = datetime.fromisoformat(key.created_at.replace("Z", "+00:00"))
        except ValueError:
            created = None

    if created is None:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} has no readable creation date, so its "
            f"age cannot be confirmed."
        )
    elif created < cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} was created on {created.date()} and has "
            f"not been rotated within {max_age_days} days."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.name or key.id} was created on {created.date()}, within "
            f"the {max_age_days} day rotation window."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "anthropic_organization_zero_data_retention_configured",
      service: "organization",
      pillar: "encryption",
      severity: "medium",
      title: "Anthropic organizations configure zero data retention where eligible",
      resourceType: "Anthropic::Organization",
      resourceGroup: "storage",
      categories: ["data-protection"],
      description:
        "This check verifies that the organization has **zero data retention** configured, so prompts and completions are not stored after the request completes.",
      risk:
        "Prompts routinely carry **source code, customer records and internal documents** that were never assessed for third-party storage, and retained copies fall outside your own deletion and residency commitments. Zero data retention narrows the window in which that content exists anywhere outside your environment to the duration of the request itself.",
      urls: [
        "https://privacy.anthropic.com/en/articles/10440198-does-anthropic-train-on-customer-data",
        "https://trust.anthropic.com/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Confirm your agreement and plan support zero data retention\n2. Request the configuration for your organization through your account contact\n3. Verify it is applied for every endpoint your workloads use, since eligibility can vary by feature\n4. Record the configuration in your processing register and vendor assessment\n5. Independently reduce exposure by redacting identifiers before they are sent, rather than relying on retention configuration alone",
        terraform: "",
        text:
          "Request zero data retention where your agreement allows, confirm it covers every endpoint in use, and redact sensitive identifiers client-side so the control does not depend solely on provider configuration.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportAnthropic(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.zero_data_retention:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has zero data "
        f"retention configured."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} does not have zero "
        f"data retention configured."
    )

findings.append(report)
return findings`,
    },
  ],
};
