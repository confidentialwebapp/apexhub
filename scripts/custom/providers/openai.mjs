/** OpenAI Platform — organization, project and API key configuration posture. */

const organization_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class Organization(OpenAIService):
    """Retrieve OpenAI organization settings, members and audit log configuration."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[OpenAIOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            users = self._paginate("/v1/organization/users", "data")
            invites = self._paginate("/v1/organization/invites", "data")
            # A single recent page is enough to confirm the audit log is populated
            # and readable; full history is not needed for a posture check.
            audit_logs = self._get(
                "/v1/organization/audit_logs", params={"limit": 1}
            )
            settings = self._get("/v1/organization/settings") or {}

            self.organization = OpenAIOrganization(
                id=self.provider.identity.organization_id or "",
                name=self.provider.identity.organization_name or "",
                mfa_required=bool(settings.get("mfa_required", False)),
                sso_enforced=bool(settings.get("sso_enforced", False)),
                domain_verified=bool(settings.get("domain_verified", False)),
                zero_data_retention=bool(settings.get("zero_data_retention", False)),
                data_retention_days=settings.get("retention_days"),
                training_opt_out=bool(settings.get("training_opt_out", True)),
                audit_log_readable=audit_logs is not None,
                audit_log_export_configured=bool(
                    settings.get("audit_log_export_enabled", False)
                ),
                members=[
                    OpenAIMember(
                        id=raw.get("id", ""),
                        email=raw.get("email", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "reader"),
                        added_at=raw.get("added_at"),
                    )
                    for raw in users
                ],
                pending_invites=[
                    raw.get("email", "") for raw in invites
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


class OpenAIMember(BaseModel):
    """A member of an OpenAI organization."""

    id: str
    email: str = ""
    name: str = ""
    role: str = "reader"
    added_at: Optional[int] = None


class OpenAIOrganization(BaseModel):
    """OpenAI organization representation."""

    id: str
    name: str = ""
    mfa_required: bool = False
    sso_enforced: bool = False
    domain_verified: bool = False
    zero_data_retention: bool = False
    data_retention_days: Optional[int] = None
    training_opt_out: bool = True
    audit_log_readable: bool = False
    audit_log_export_configured: bool = False
    members: list[OpenAIMember] = Field(default_factory=list)
    pending_invites: list[str] = Field(default_factory=list)
`;

const project_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class Project(OpenAIService):
    """Retrieve OpenAI projects with their service accounts and rate limits."""

    def __init__(self, provider):
        super().__init__("Project", provider)
        self.projects: dict[str, OpenAIProject] = {}
        self._list_projects()
        self.__threading_call__(
            self._get_project_detail, list(self.projects.values())
        )

    def _list_projects(self):
        try:
            for raw in self._paginate("/v1/organization/projects", "data"):
                project = OpenAIProject(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    status=raw.get("status", "active"),
                    created_at=raw.get("created_at"),
                )
                self.projects[project.id] = project
            logger.info(f"Project - Found {len(self.projects)} project(s)")
        except Exception as error:
            logger.error(
                f"Project - Error listing projects: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_project_detail(self, project: "OpenAIProject"):
        try:
            for raw in (
                self._paginate(
                    f"/v1/organization/projects/{project.id}/service_accounts", "data"
                )
                or []
            ):
                project.service_accounts.append(
                    OpenAIServiceAccount(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "member"),
                        created_at=raw.get("created_at"),
                    )
                )

            limits = self._paginate(
                f"/v1/organization/projects/{project.id}/rate_limits", "data"
            )
            project.rate_limits_configured = bool(limits)
        except Exception as error:
            logger.error(
                f"Project - Error fetching detail for {project.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OpenAIServiceAccount(BaseModel):
    """A service account belonging to an OpenAI project."""

    id: str
    name: str = ""
    role: str = "member"
    created_at: Optional[int] = None


class OpenAIProject(BaseModel):
    """OpenAI project representation."""

    id: str
    name: str = ""
    status: str = "active"
    created_at: Optional[int] = None
    rate_limits_configured: bool = False
    service_accounts: list[OpenAIServiceAccount] = Field(default_factory=list)
`;

const apikey_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class ApiKey(OpenAIService):
    """Retrieve OpenAI admin and project API keys with their ownership and age."""

    def __init__(self, provider):
        super().__init__("ApiKey", provider)
        self.keys: dict[str, OpenAIApiKey] = {}
        self._list_admin_keys()
        self._list_project_keys()

    def _list_admin_keys(self):
        try:
            for raw in self._paginate("/v1/organization/admin_api_keys", "data"):
                key = OpenAIApiKey(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    scope="organization",
                    project_id=None,
                    owner_type=(raw.get("owner") or {}).get("type", "user"),
                    owner_name=(raw.get("owner") or {}).get("name", ""),
                    created_at=raw.get("created_at"),
                    last_used_at=raw.get("last_used_at"),
                )
                self.keys[key.id] = key
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing admin API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _list_project_keys(self):
        try:
            for project in self._paginate("/v1/organization/projects", "data"):
                project_id = project.get("id", "")
                for raw in (
                    self._paginate(
                        f"/v1/organization/projects/{project_id}/api_keys", "data"
                    )
                    or []
                ):
                    owner = raw.get("owner") or {}
                    key = OpenAIApiKey(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        scope="project",
                        project_id=project_id,
                        project_name=project.get("name", ""),
                        owner_type=owner.get("type", "user"),
                        owner_name=(owner.get("service_account") or owner.get("user") or {}).get(
                            "name", ""
                        ),
                        created_at=raw.get("created_at"),
                        last_used_at=raw.get("last_used_at"),
                    )
                    self.keys[key.id] = key
            logger.info(f"ApiKey - Found {len(self.keys)} API key(s)")
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing project API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OpenAIApiKey(BaseModel):
    """OpenAI API key representation."""

    id: str
    name: str = ""
    scope: str = "project"
    project_id: Optional[str] = None
    project_name: str = ""
    owner_type: str = "user"
    owner_name: str = ""
    created_at: Optional[int] = None
    last_used_at: Optional[int] = None
`;

export default {
  id: "openai",
  name: "OpenAI Platform",
  pyClass: "OpenAI",
  baseUrl: "https://api.openai.com",
  samplePath: "/v1/organization/projects",
  errorCodeBase: 14500,
  pageParam: "after",
  pageSizeParam: "limit",
  pageSize: 100,
  credentialsRemediation:
    "Set OPENAI_ADMIN_KEY to an organization admin API key. Generate one under Settings > Organization > Admin keys; a standard project key cannot read organization configuration.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for the OpenAI Platform assesses an OpenAI organization across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers console authentication, API key scoping and ownership, project isolation, rate limiting and data retention — the controls that govern who can spend against your account and what happens to the data you send it.",

  services: {
    organization: { pyClass: "Organization", source: organization_service },
    project: { pyClass: "Project", source: project_service },
    apikey: { pyClass: "ApiKey", source: apikey_service },
  },

  checks: [
    {
      id: "openai_organization_mfa_required",
      service: "organization",
      pillar: "iam",
      severity: "critical",
      title: "OpenAI organizations require multi-factor authentication",
      resourceType: "OpenAI::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the OpenAI organization requires **multi-factor authentication** for console sign-in, so that access to API keys, billing and project configuration is not protected by a password alone.",
      risk:
        "Console access is what mints and reads **API keys**, so a password-only account is the shortest path to a durable credential for your models and, through those keys, to any data your prompts carry. Because usage is billed, a compromised organization also produces immediate financial loss through model abuse before the intrusion is even noticed.",
      urls: [
        "https://platform.openai.com/docs/guides/your-data",
        "https://help.openai.com/en/articles/8897277-api-organization-access-management",
      ],
      relatedTo: ["openai_organization_sso_enforced"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to the OpenAI platform console as an owner\n2. Go to **Settings > Organization > General**\n3. Enable the requirement for multi-factor authentication\n4. Notify members before enforcing, since those without MFA lose access until they enrol\n5. Where the organization is federated, enforce MFA in the identity provider's conditional access policy instead so it applies uniformly",
        terraform: "",
        text:
          "Require MFA for every member of the OpenAI organization, or enforce it upstream in your identity provider if console access is federated through SSO.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportOpenAI(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

if organization.mfa_required:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} requires "
        f"multi-factor authentication."
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
      id: "openai_organization_sso_enforced",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "OpenAI organizations enforce SSO with a verified domain",
      resourceType: "OpenAI::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the organization enforces **single sign-on** and has verified its email domain, so membership follows the corporate identity provider rather than individually created accounts.",
      risk:
        "Without enforced SSO, members sign in with **personal credentials outside your control**, so leavers keep access until someone remembers to remove them manually, and there is no conditional access or central session revocation. An unverified domain also allows anyone with a company email address to self-register outside the governed organization entirely.",
      urls: [
        "https://help.openai.com/en/articles/8983845-sso-for-chatgpt-enterprise-and-api-organizations",
        "https://platform.openai.com/docs/guides/production-best-practices",
      ],
      relatedTo: ["openai_organization_mfa_required"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to the OpenAI platform console as an owner\n2. Go to **Settings > Organization > Security**\n3. Verify your email domain by publishing the supplied DNS record\n4. Configure the SAML connection to your identity provider\n5. Test with a pilot user, then enable **Enforce SSO**\n6. Remove any accounts using personal email addresses once federation is proven",
        terraform: "",
        text:
          "Verify your domain and enforce SSO so OpenAI membership is governed by your identity provider, with SCIM provisioning where available so leavers are deprovisioned automatically.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportOpenAI(
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
elif organization.sso_enforced:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} enforces SSO but has "
        f"no verified domain, so accounts can be created outside it."
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
      id: "openai_organization_audit_log_export_configured",
      service: "organization",
      pillar: "logging",
      severity: "medium",
      title: "OpenAI organizations export audit logs to an external system",
      resourceType: "OpenAI::Organization::AuditLog",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "This check verifies that the organization's **audit log** is readable and exported to an external system, so records of key creation, member changes and project configuration survive outside the platform.",
      risk:
        "API key creation is the single most security-relevant event in an OpenAI organization, and without exported logs there is **no durable record of who minted which key and when**. During an investigation into leaked model access or unexpected spend, that gap makes it impossible to distinguish legitimate provisioning from an attacker establishing persistence.",
      urls: [
        "https://platform.openai.com/docs/api-reference/audit-logs",
        "https://help.openai.com/en/articles/8983845-sso-for-chatgpt-enterprise-and-api-organizations",
      ],
      remediation: {
        cli: "curl https://api.openai.com/v1/organization/audit_logs \\\n  -H \"Authorization: Bearer $OPENAI_ADMIN_KEY\"",
        other:
          "1. Confirm your plan includes audit log access\n2. Build or enable a scheduled export that pulls `/v1/organization/audit_logs` into your SIEM\n3. Alert on `api_key.created`, `invite.sent`, `organization.updated` and `project.created` events\n4. Alert specifically on admin key creation, which grants organization-wide control\n5. Retain the exported logs according to your incident investigation window",
        terraform: "",
        text:
          "Export the OpenAI audit log into your SIEM on a schedule and alert on API key creation, member invitations and organization setting changes.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportOpenAI(
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
elif organization.audit_log_readable:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has a readable audit "
        f"log but no export configured."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} audit log is not "
        f"readable; confirm the plan includes audit log access."
    )

findings.append(report)
return findings`,
    },

    {
      id: "openai_organization_data_retention_limited",
      service: "organization",
      pillar: "encryption",
      severity: "medium",
      title: "OpenAI organizations limit prompt data retention and opt out of training",
      resourceType: "OpenAI::Organization",
      resourceGroup: "storage",
      categories: ["data-protection"],
      description:
        "This check verifies that the organization opts out of using API data for **model training** and has a bounded retention window — ideally zero data retention — for prompts and completions.",
      risk:
        "Prompts routinely carry **customer records, source code and internal documents** that were never classified for third-party storage. Where retention is unbounded, that content sits outside your environment beyond the reach of your own deletion and residency commitments, and any breach of the provider's storage becomes a breach of your data.",
      urls: [
        "https://platform.openai.com/docs/guides/your-data",
        "https://openai.com/enterprise-privacy/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Sign in to the OpenAI platform console as an owner\n2. Go to **Settings > Organization > Data controls**\n3. Confirm that API data is not used for model training\n4. Request **Zero Data Retention** for eligible endpoints if your data handling requirements call for it\n5. Record the configured retention window in your processing register\n6. Independently reduce what is sent: redact identifiers before they reach the API rather than relying on retention settings alone",
        terraform: "",
        text:
          "Opt out of training, request zero data retention where eligible, and redact sensitive identifiers before they are sent so the control does not depend solely on the provider's configuration.",
      },
      body: `findings = []
organization = organization_client.organization
if organization is None:
    return findings

report = CheckReportOpenAI(
    metadata=self.metadata(),
    resource=organization,
    resource_name=organization.name or organization.id,
    resource_id=organization.id,
)

retention = organization.data_retention_days

if organization.zero_data_retention and organization.training_opt_out:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} uses zero data "
        f"retention and does not contribute data to model training."
    )
elif not organization.training_opt_out:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} allows API data to "
        f"be used for model training."
    )
elif retention is None:
    report.status = "FAIL"
    report.status_extended = (
        f"Organization {organization.name or organization.id} has no bounded data "
        f"retention window configured."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Organization {organization.name or organization.id} retains API data for "
        f"{retention} day(s) and does not contribute it to model training."
    )

findings.append(report)
return findings`,
    },

    {
      id: "openai_apikey_scoped_to_project",
      service: "apikey",
      pillar: "iam",
      severity: "high",
      title: "OpenAI API keys are scoped to a project rather than the organization",
      resourceType: "OpenAI::ApiKey",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "**Project API keys** are limited to one project's models, rate limits and budget, while **admin keys** carry organization-wide control. This check reports keys issued at organization scope, which should exist only for administrative automation.",
      risk:
        "An organization-scoped admin key can **create further keys, add members and change billing**, so leaking one is equivalent to losing the console itself rather than losing access to a single workload. Because these keys are often pasted into shared automation, one exposure grants durable, self-renewing control of the entire account.",
      urls: [
        "https://platform.openai.com/docs/api-reference/administration",
        "https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects",
      ],
      relatedTo: ["openai_apikey_no_stale_keys"],
      remediation: {
        cli: "curl -X DELETE https://api.openai.com/v1/organization/admin_api_keys/<key-id> \\\n  -H \"Authorization: Bearer $OPENAI_ADMIN_KEY\"",
        other:
          "1. Create a project for each workload in **Settings > Projects**\n2. Issue a project API key owned by a **service account**, not a person\n3. Update the workload to use the project key\n4. Delete the admin key it replaced\n5. Retain admin keys only for provisioning automation, and store them in a secrets manager with access logging\n6. Set per-project rate limits and budgets so a compromised project key has a bounded cost",
        terraform: "",
        text:
          "Issue one service-account-owned project key per workload, keep admin keys to the minimum needed for provisioning automation, and bound each project with its own rate limit and budget.",
      },
      body: `findings = []
for key in apikey_client.keys.values():
    report = CheckReportOpenAI(
        metadata=self.metadata(),
        resource=key,
        resource_name=key.name or key.id,
        resource_id=key.id,
    )

    if key.scope == "project":
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.name or key.id} is scoped to project "
            f"{key.project_name or key.project_id}."
        )
        if key.owner_type == "user":
            report.status_extended += (
                f" It is owned by user {key.owner_name}; prefer a service account."
            )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} is scoped to the organization and "
            f"carries administrative privileges."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "openai_apikey_no_stale_keys",
      service: "apikey",
      pillar: "iam",
      severity: "medium",
      title: "OpenAI API keys are rotated and unused keys are removed",
      resourceType: "OpenAI::ApiKey",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check reports API keys that have never been used, or whose last use predates the configured staleness threshold (90 days by default), and keys older than the configured maximum age.",
      risk:
        "OpenAI API keys **do not expire**, so a key pasted into a notebook, a container image or a chat message stays valid until someone deletes it. Unused keys are the ones nobody will notice being used, and because billing is per-token, a stolen key produces cost and data exposure long before anyone connects the spend to a leak.",
      urls: [
        "https://platform.openai.com/docs/guides/production-best-practices",
        "https://platform.openai.com/docs/api-reference/administration",
      ],
      relatedTo: ["openai_apikey_scoped_to_project"],
      remediation: {
        cli: "curl https://api.openai.com/v1/organization/projects/<project-id>/api_keys \\\n  -H \"Authorization: Bearer $OPENAI_ADMIN_KEY\"",
        other:
          "1. List the keys in each project and identify those with no recent use\n2. Confirm with the owning team, then delete them\n3. Rotate keys still in use on a fixed schedule: create the replacement, deploy it, verify traffic moved, then delete the old key\n4. Store keys in a secrets manager rather than in environment files committed to source control\n5. Enable spend alerts so anomalous usage on a leaked key surfaces quickly",
        terraform: "",
        text:
          "Delete unused keys, rotate active ones on a fixed schedule with an overlap window, store them in a secrets manager, and enable spend alerts so misuse is detected by cost anomaly.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_idle_days = self.audit_config.get("max_api_key_idle_days", 90)
max_age_days = self.audit_config.get("max_api_key_age_days", 365)
now = datetime.now(timezone.utc)
idle_cutoff = now - timedelta(days=max_idle_days)
age_cutoff = now - timedelta(days=max_age_days)

findings = []
for key in apikey_client.keys.values():
    report = CheckReportOpenAI(
        metadata=self.metadata(),
        resource=key,
        resource_name=key.name or key.id,
        resource_id=key.id,
    )

    last_used = (
        datetime.fromtimestamp(key.last_used_at, tz=timezone.utc)
        if key.last_used_at
        else None
    )
    created = (
        datetime.fromtimestamp(key.created_at, tz=timezone.utc)
        if key.created_at
        else None
    )

    if last_used is None:
        report.status = "FAIL"
        report.status_extended = f"API key {key.name or key.id} has never been used."
    elif last_used < idle_cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} was last used on {last_used.date()} "
            f"(threshold {max_idle_days} days)."
        )
    elif created is not None and created < age_cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.name or key.id} was created on {created.date()} and has "
            f"not been rotated within {max_age_days} days."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.name or key.id} was last used on {last_used.date()}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "openai_project_service_accounts_used_for_automation",
      service: "project",
      pillar: "iam",
      severity: "medium",
      title: "OpenAI projects use service accounts for automated workloads",
      resourceType: "OpenAI::Project::ServiceAccount",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "A **service account** is a project-scoped, non-human identity whose keys survive personnel changes. This check reports active projects with no service account, which indicates that automation is running on keys owned by individual users.",
      risk:
        "When production traffic runs on a personal API key, **removing that person from the organization breaks production**, so offboarding is quietly skipped and their access persists. Attribution also breaks down: every request in the audit log appears to come from an individual who may have had nothing to do with the workload.",
      urls: [
        "https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects",
        "https://platform.openai.com/docs/api-reference/administration",
      ],
      relatedTo: ["openai_apikey_scoped_to_project"],
      remediation: {
        cli: "curl -X POST https://api.openai.com/v1/organization/projects/<project-id>/service_accounts \\\n  -H \"Authorization: Bearer $OPENAI_ADMIN_KEY\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"production-inference\"}'",
        other:
          "1. Open the project in **Settings > Projects**\n2. Create a service account for each automated workload\n3. Issue an API key owned by that service account\n4. Deploy the new key, verify traffic has moved, then delete the user-owned key it replaced\n5. Archive projects that are no longer in use so their keys stop working",
        terraform: "",
        text:
          "Create a service account per automated workload and issue its keys from that identity, so offboarding a person never disrupts production and audit records attribute traffic correctly.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.status != "active":
        continue

    report = CheckReportOpenAI(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name or project.id,
        resource_id=project.id,
    )

    if project.service_accounts:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.name or project.id} has "
            f"{len(project.service_accounts)} service account(s) for automation."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name or project.id} has no service account; "
            f"automation is running on user-owned keys."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "openai_project_rate_limits_configured",
      service: "project",
      pillar: "attacksurface",
      severity: "medium",
      title: "OpenAI projects define per-project rate limits",
      resourceType: "OpenAI::Project::RateLimit",
      resourceGroup: "compute",
      categories: ["resilience"],
      description:
        "Per-project **rate limits** cap the request and token throughput a project may consume. This check reports active projects with no rate limit override, which leaves them able to consume the whole organization's capacity and budget.",
      risk:
        "Without per-project limits, a leaked key or a runaway retry loop consumes the **entire organization's quota and budget**, taking every other project down with it — a denial of service against your own production traffic. Uncapped spend on a stolen key also converts a credential leak directly into unbounded financial loss.",
      urls: [
        "https://platform.openai.com/docs/guides/rate-limits",
        "https://platform.openai.com/docs/api-reference/project-rate-limits",
      ],
      relatedTo: ["openai_apikey_no_stale_keys"],
      remediation: {
        cli: "curl -X POST https://api.openai.com/v1/organization/projects/<project-id>/rate_limits/<limit-id> \\\n  -H \"Authorization: Bearer $OPENAI_ADMIN_KEY\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"max_requests_per_1_minute\":500}'",
        other:
          "1. Open the project in **Settings > Projects > Limits**\n2. Set request and token per-minute limits sized to the workload's actual peak plus headroom\n3. Set a monthly budget for the project and enable notification thresholds\n4. Handle 429 responses in the client with exponential backoff rather than raising the limit\n5. Review limits when traffic patterns change",
        terraform: "",
        text:
          "Set per-project request, token and budget limits sized to each workload's real peak, and handle rate limit responses with backoff so a single project cannot exhaust organization capacity.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.status != "active":
        continue

    report = CheckReportOpenAI(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name or project.id,
        resource_id=project.id,
    )

    if project.rate_limits_configured:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.name or project.id} defines per-project rate limits."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name or project.id} defines no per-project rate "
            f"limits and can consume the organization's full quota."
        )

    findings.append(report)

return findings`,
    },
  ],
};
