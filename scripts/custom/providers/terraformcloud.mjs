/** HCP Terraform / Terraform Enterprise — organization and workspace posture. */

const organization_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.terraformcloud.lib.service.service import TerraformCloudService


class Organization(TerraformCloudService):
    """Retrieve HCP Terraform organizations with their authentication policy."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organizations: dict[str, TerraformOrganization] = {}
        self._list_organizations()
        self.__threading_call__(
            self._get_audit_configuration, list(self.organizations.values())
        )

    def _list_organizations(self):
        try:
            for raw in self._paginate("/api/v2/organizations", "data"):
                attributes = raw.get("attributes") or {}
                organization = TerraformOrganization(
                    name=raw.get("id", ""),
                    email=attributes.get("email", ""),
                    two_factor_conformant=bool(
                        attributes.get("two-factor-conformant", False)
                    ),
                    sso_enabled=bool(attributes.get("saml-enabled", False)),
                    collaborator_auth_policy=attributes.get(
                        "collaborator-auth-policy", "password"
                    ),
                    owners_team_saml_role_id=attributes.get(
                        "owners-team-saml-role-id"
                    ),
                )
                self.organizations[organization.name] = organization
            logger.info(
                f"Organization - Found {len(self.organizations)} organization(s)"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error listing organizations: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_configuration(self, organization: "TerraformOrganization"):
        """Confirm the audit trail is readable for the organization."""
        try:
            trail = self._get(
                "/api/v2/organization/audit-trails",
                params={"page[size]": 1},
            )
            organization.audit_trail_readable = trail is not None
        except Exception as error:
            logger.error(
                f"Organization - Error reading audit trail for {organization.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class TerraformOrganization(BaseModel):
    """HCP Terraform organization representation."""

    name: str
    email: str = ""
    two_factor_conformant: bool = False
    sso_enabled: bool = False
    collaborator_auth_policy: str = "password"
    owners_team_saml_role_id: Optional[str] = None
    audit_trail_readable: bool = False
`;

const workspace_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.terraformcloud.lib.service.service import TerraformCloudService


class Workspace(TerraformCloudService):
    """Retrieve HCP Terraform workspaces with their variables and sharing settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, TerraformWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_variables, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for organization in self.provider.identity.organizations:
                for raw in self._paginate(
                    f"/api/v2/organizations/{organization}/workspaces", "data"
                ):
                    attributes = raw.get("attributes") or {}
                    workspace = TerraformWorkspace(
                        id=raw.get("id", ""),
                        name=attributes.get("name", ""),
                        organization=organization,
                        auto_apply=bool(attributes.get("auto-apply", False)),
                        execution_mode=attributes.get("execution-mode", "remote"),
                        global_remote_state=bool(
                            attributes.get("global-remote-state", False)
                        ),
                        speculative_enabled=bool(
                            attributes.get("speculative-enabled", True)
                        ),
                        assessments_enabled=bool(
                            attributes.get("assessments-enabled", False)
                        ),
                        terraform_version=attributes.get("terraform-version", ""),
                        locked=bool(attributes.get("locked", False)),
                    )
                    self.workspaces[workspace.id] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_variables(self, workspace: "TerraformWorkspace"):
        try:
            for raw in (
                self._paginate(f"/api/v2/workspaces/{workspace.id}/vars", "data") or []
            ):
                attributes = raw.get("attributes") or {}
                workspace.variables.append(
                    TerraformVariable(
                        id=raw.get("id", ""),
                        key=attributes.get("key", ""),
                        category=attributes.get("category", "terraform"),
                        sensitive=bool(attributes.get("sensitive", False)),
                        hcl=bool(attributes.get("hcl", False)),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching variables for {workspace.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class TerraformVariable(BaseModel):
    """A workspace variable in HCP Terraform."""

    id: str
    key: str = ""
    category: str = "terraform"
    sensitive: bool = False
    hcl: bool = False


class TerraformWorkspace(BaseModel):
    """HCP Terraform workspace representation."""

    id: str
    name: str = ""
    organization: str = ""
    auto_apply: bool = False
    execution_mode: str = "remote"
    global_remote_state: bool = False
    speculative_enabled: bool = True
    assessments_enabled: bool = False
    terraform_version: str = ""
    locked: bool = False
    variables: list[TerraformVariable] = Field(default_factory=list)
`;

export default {
  id: "terraformcloud",
  name: "HCP Terraform",
  pyClass: "TerraformCloud",
  baseUrl: "https://app.terraform.io",
  samplePath: "/api/v2/organizations",
  errorCodeBase: 15200,
  pageParam: "page[number]",
  pageSizeParam: "page[size]",
  pageSize: 100,
  credentialsRemediation:
    "Set TFC_TOKEN to an organization or team API token with read access to workspaces, variables and the audit trail. Set TFE_ADDRESS for a Terraform Enterprise installation.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for HCP Terraform assesses a Terraform organization and its workspaces across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers SSO and two-factor enforcement, sensitive variable marking, dynamic provider credentials, remote state sharing, auto-apply and health assessments — the controls that decide whether the system that provisions your infrastructure can be used to take it over.",

  services: {
    organization: { pyClass: "Organization", source: organization_service },
    workspace: { pyClass: "Workspace", source: workspace_service },
  },

  checks: [
    {
      id: "terraformcloud_workspace_sensitive_variables_marked",
      service: "workspace",
      pillar: "encryption",
      severity: "critical",
      title: "HCP Terraform workspace variables holding credentials are marked sensitive",
      resourceType: "TerraformCloud::Workspace::Variable",
      resourceGroup: "secrets",
      categories: ["ci-cd", "secrets"],
      description:
        "A **sensitive** workspace variable is write-only: its value cannot be read back through the API or UI and is redacted from run output. This check reports variables whose names indicate a credential but that are not marked sensitive.",
      risk:
        "A non-sensitive variable's value is **readable by every user with workspace read access and returned by the API**, and it appears in plan output where it is retained in run history indefinitely. Because these variables typically hold the cloud credentials Terraform provisions with, one exposed value grants the same access Terraform itself has — which is usually administrative.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/variables/managing-variables",
        "https://developer.hashicorp.com/terraform/cloud-docs/api-docs/workspace-variables",
      ],
      relatedTo: ["terraformcloud_workspace_dynamic_credentials_configured"],
      remediation: {
        cli: "curl -X PATCH \"https://app.terraform.io/api/v2/workspaces/<workspace-id>/vars/<var-id>\" \\\n  -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  -H 'Content-Type: application/vnd.api+json' \\\n  -d '{\"data\":{\"type\":\"vars\",\"attributes\":{\"sensitive\":true}}}'",
        other:
          "1. Open the workspace and go to **Variables**\n2. For each credential variable, edit it and tick **Sensitive**\n3. Rotate the credential — its value has been readable through the API and may appear in retained plan output\n4. Move shared credentials into a **variable set** so they are managed in one place\n5. Better still, replace static credentials with dynamic provider credentials so no long-lived secret is stored at all",
        terraform:
          'resource "tfe_variable" "aws_secret" {\n  key          = "AWS_SECRET_ACCESS_KEY"\n  value        = var.aws_secret\n  category     = "env"\n  sensitive    = true\n  workspace_id = tfe_workspace.prod.id\n}',
        text:
          "Mark every credential-bearing variable sensitive, rotate anything previously stored in the clear, and migrate to dynamic provider credentials so no static secret is stored.",
      },
      body: `SECRET_HINTS = (
    "secret",
    "token",
    "password",
    "passwd",
    "apikey",
    "api_key",
    "private_key",
    "credential",
    "access_key",
    "client_secret",
)

findings = []
for workspace in workspace_client.workspaces.values():
    for variable in workspace.variables:
        key_lower = variable.key.lower()
        if not any(hint in key_lower for hint in SECRET_HINTS):
            continue

        report = CheckReportTerraformCloud(
            metadata=self.metadata(),
            resource=variable,
            resource_name=f"{workspace.name}/{variable.key}",
            resource_id=variable.id,
        )

        if variable.sensitive:
            report.status = "PASS"
            report.status_extended = (
                f"Variable {variable.key} in workspace {workspace.name} is marked "
                f"sensitive."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Variable {variable.key} in workspace {workspace.name} appears to "
                f"hold a credential but is not marked sensitive."
            )

        findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_workspace_dynamic_credentials_configured",
      service: "workspace",
      pillar: "iam",
      severity: "high",
      title: "HCP Terraform workspaces use dynamic provider credentials",
      resourceType: "TerraformCloud::Workspace::Variable",
      resourceGroup: "iam",
      categories: ["ci-cd", "secrets"],
      description:
        "**Dynamic provider credentials** let a workspace exchange a signed workload identity token for short-lived cloud credentials at run time. This check reports workspaces still holding static cloud access keys as environment variables.",
      risk:
        "A static cloud access key stored in a Terraform workspace is a **long-lived credential with provisioning privileges** — typically broad enough to create IAM principals, which makes it a privilege escalation path into the whole cloud account. It never expires, exists in a system many engineers can read, and its compromise is not detectable from the cloud side, since the calls look like ordinary Terraform runs.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials",
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration",
      ],
      relatedTo: ["terraformcloud_workspace_sensitive_variables_marked"],
      remediation: {
        cli: "# Set the workspace to use dynamic credentials instead of static keys:\n#   TFC_AWS_PROVIDER_AUTH = true\n#   TFC_AWS_RUN_ROLE_ARN  = arn:aws:iam::123456789012:role/tfc-run\n# then delete AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
        other:
          "1. Create an OIDC identity provider in the cloud account trusting `app.terraform.io`\n2. Create a role whose trust policy is scoped to the specific organization, project and workspace\n3. Grant the role only the permissions that workspace's configuration actually needs\n4. Set `TFC_<PROVIDER>_PROVIDER_AUTH` and the run role variable on the workspace\n5. Run a plan to confirm authentication succeeds\n6. Delete the static access key variables and **deactivate the key in the cloud account** — removing it from Terraform does not revoke it",
        terraform:
          'resource "tfe_variable" "aws_auth" {\n  key          = "TFC_AWS_PROVIDER_AUTH"\n  value        = "true"\n  category     = "env"\n  workspace_id = tfe_workspace.prod.id\n}\n\nresource "tfe_variable" "aws_role" {\n  key          = "TFC_AWS_RUN_ROLE_ARN"\n  value        = aws_iam_role.tfc_run.arn\n  category     = "env"\n  workspace_id = tfe_workspace.prod.id\n}',
        text:
          "Move workspaces to dynamic provider credentials with a trust policy scoped to the specific workspace, then delete the static keys from Terraform and deactivate them in the cloud account.",
      },
      body: `STATIC_CREDENTIAL_KEYS = {
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "ARM_CLIENT_SECRET",
    "GOOGLE_CREDENTIALS",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "VAULT_TOKEN",
}
DYNAMIC_AUTH_PREFIX = "TFC_"
DYNAMIC_AUTH_SUFFIX = "_PROVIDER_AUTH"

findings = []
for workspace in workspace_client.workspaces.values():
    env_keys = {
        variable.key.upper()
        for variable in workspace.variables
        if variable.category == "env"
    }

    static = env_keys & STATIC_CREDENTIAL_KEYS
    dynamic = {
        key
        for key in env_keys
        if key.startswith(DYNAMIC_AUTH_PREFIX) and key.endswith(DYNAMIC_AUTH_SUFFIX)
    }

    # Workspaces with no provider credentials at all are out of scope here.
    if not static and not dynamic:
        continue

    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=f"{workspace.organization}/{workspace.name}",
        resource_id=workspace.id,
    )

    if dynamic and not static:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.name} uses dynamic provider credentials "
            f"({', '.join(sorted(dynamic))})."
        )
    elif dynamic:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name} configures dynamic provider credentials "
            f"but still holds static credential(s): {', '.join(sorted(static))}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name} authenticates with static cloud "
            f"credential(s): {', '.join(sorted(static))}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_workspace_remote_state_not_globally_shared",
      service: "workspace",
      pillar: "attacksurface",
      severity: "high",
      title: "HCP Terraform workspaces do not share remote state organization-wide",
      resourceType: "TerraformCloud::Workspace",
      resourceGroup: "storage",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "The `global-remote-state` setting allows **every workspace in the organization** to read a workspace's state. This check reports workspaces with global sharing enabled instead of an explicit consumer list.",
      risk:
        "Terraform state contains the **full attribute set of every resource**, including generated passwords, private keys, connection strings and any provider output the configuration touched — regardless of whether the corresponding variable was marked sensitive. Sharing it organization-wide means anyone who can create a workspace can read the credentials of your production environment.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/state",
        "https://developer.hashicorp.com/terraform/language/state/sensitive-data",
      ],
      relatedTo: ["terraformcloud_workspace_sensitive_variables_marked"],
      remediation: {
        cli: "curl -X PATCH \"https://app.terraform.io/api/v2/workspaces/<workspace-id>\" \\\n  -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  -H 'Content-Type: application/vnd.api+json' \\\n  -d '{\"data\":{\"type\":\"workspaces\",\"attributes\":{\"global-remote-state\":false}}}'",
        other:
          "1. Open the workspace and go to **Settings > General**\n2. Set remote state sharing to **Share with specific workspaces**\n3. List only the workspaces that genuinely consume this state\n4. Prefer passing values through a data source or a variable set over remote state sharing where practical\n5. Review the existing state for secrets, and rotate anything that was broadly readable\n6. Restrict who can read state at the team level as well",
        terraform:
          'resource "tfe_workspace" "prod" {\n  name                  = "prod"\n  organization          = var.organization\n  global_remote_state   = false\n  remote_state_consumer_ids = [tfe_workspace.app.id]\n}',
        text:
          "Replace global remote state sharing with an explicit consumer list, and rotate any secret that appeared in state while it was organization-readable.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=f"{workspace.organization}/{workspace.name}",
        resource_id=workspace.id,
    )

    if workspace.global_remote_state:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name} shares its remote state with every "
            f"workspace in organization {workspace.organization}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.name} restricts remote state access to an "
            f"explicit consumer list."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_workspace_auto_apply_disabled",
      service: "workspace",
      pillar: "attacksurface",
      severity: "medium",
      title: "HCP Terraform workspaces require manual apply approval",
      resourceType: "TerraformCloud::Workspace",
      resourceGroup: "compute",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "With **auto-apply** enabled, a workspace applies a successful plan without human review. This check reports workspaces where auto-apply is on, so approval is a deliberate exception rather than the default.",
      risk:
        "Auto-apply removes the last review point between a merged configuration change and **live infrastructure**, so a malicious or mistaken commit reaches production without anyone reading the plan. Terraform plans also surface destructive actions — resource replacement and deletion — that a reviewer would catch; auto-apply executes them silently.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/settings",
        "https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement",
      ],
      relatedTo: ["terraformcloud_workspace_health_assessments_enabled"],
      remediation: {
        cli: "curl -X PATCH \"https://app.terraform.io/api/v2/workspaces/<workspace-id>\" \\\n  -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  -H 'Content-Type: application/vnd.api+json' \\\n  -d '{\"data\":{\"type\":\"workspaces\",\"attributes\":{\"auto-apply\":false}}}'",
        other:
          "1. Open the workspace and go to **Settings > General**\n2. Set **Apply Method** to `Manual apply`\n3. Restrict apply permission to a specific team through **Team Access**\n4. Add Sentinel or OPA policies to block high-risk changes automatically, so review effort concentrates on what matters\n5. Where auto-apply is genuinely appropriate — a low-risk, non-production workspace — record the exception explicitly",
        terraform:
          'resource "tfe_workspace" "prod" {\n  name         = "prod"\n  organization = var.organization\n  auto_apply   = false\n}',
        text:
          "Require manual apply on production workspaces, restrict apply permission to a named team, and add policy checks so risky changes are blocked rather than only reviewed.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=f"{workspace.organization}/{workspace.name}",
        resource_id=workspace.id,
    )

    if workspace.auto_apply:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name} applies plans automatically without "
            f"manual approval."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.name} requires manual approval before applying."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_workspace_health_assessments_enabled",
      service: "workspace",
      pillar: "logging",
      severity: "low",
      title: "HCP Terraform workspaces enable health assessments and drift detection",
      resourceType: "TerraformCloud::Workspace",
      resourceGroup: "compute",
      categories: ["ci-cd", "resilience"],
      description:
        "**Health assessments** periodically re-plan a workspace to detect drift between the configuration and the real infrastructure. This check reports workspaces with assessments disabled.",
      risk:
        "Without drift detection, an **out-of-band change to production goes unnoticed** until the next apply, which then silently reverts or compounds it. From a security standpoint drift is often the signal itself: a security group opened by hand, a policy loosened during an incident, or an attacker's modification all appear as drift, and detecting them at the next scheduled assessment is far faster than at the next release.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/health",
        "https://developer.hashicorp.com/terraform/cloud-docs/workspaces/settings",
      ],
      relatedTo: ["terraformcloud_workspace_auto_apply_disabled"],
      remediation: {
        cli: "curl -X PATCH \"https://app.terraform.io/api/v2/workspaces/<workspace-id>\" \\\n  -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  -H 'Content-Type: application/vnd.api+json' \\\n  -d '{\"data\":{\"type\":\"workspaces\",\"attributes\":{\"assessments-enabled\":true}}}'",
        other:
          "1. Open the workspace and go to **Settings > Health**\n2. Enable **Health assessments**\n3. Confirm the workspace's credentials permit a read-only plan on a schedule\n4. Route drift notifications to the owning team, not just to the workspace page\n5. Treat unexplained drift on security-relevant resources as a potential incident rather than a cleanup task\n6. Note that assessments require a paid tier and a remote execution mode",
        terraform:
          'resource "tfe_workspace" "prod" {\n  name                = "prod"\n  organization        = var.organization\n  assessments_enabled = true\n}',
        text:
          "Enable health assessments so drift is detected on a schedule, route notifications to the owning team, and treat unexplained drift on security-relevant resources as a potential incident.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    # Assessments require remote execution; local workspaces cannot run them.
    if workspace.execution_mode == "local":
        continue

    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=f"{workspace.organization}/{workspace.name}",
        resource_id=workspace.id,
    )

    if workspace.assessments_enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.name} has health assessments enabled."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.name} has health assessments disabled, so drift "
            f"is not detected between runs."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_organization_sso_enforced",
      service: "organization",
      pillar: "iam",
      severity: "critical",
      title: "HCP Terraform organizations enforce SSO for collaborators",
      resourceType: "TerraformCloud::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "The organization's **collaborator authentication policy** governs how members sign in. This check verifies that SAML SSO is enabled and set as the required policy rather than allowing password authentication.",
      risk:
        "HCP Terraform holds the credentials that **provision your entire cloud estate**, so an account there is effectively an administrative account for the infrastructure it manages. Without enforced SSO there is no conditional access and no central revocation, and a departed engineer's account keeps its apply permissions until someone remembers to remove it.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/single-sign-on",
        "https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/organizations",
      ],
      relatedTo: ["terraformcloud_organization_two_factor_conformant"],
      remediation: {
        cli: "curl -X PATCH \"https://app.terraform.io/api/v2/organizations/<organization>\" \\\n  -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  -H 'Content-Type: application/vnd.api+json' \\\n  -d '{\"data\":{\"type\":\"organizations\",\"attributes\":{\"collaborator-auth-policy\":\"sso\"}}}'",
        other:
          "1. In the organization settings, go to **SSO** and configure the SAML connection to your identity provider\n2. Test sign-in with a pilot user\n3. Set the **Authentication** policy to require SSO\n4. Map the owners team to a SAML role so organization ownership follows the IdP group\n5. Keep one documented break-glass owner account with a strong credential and monitoring\n6. Review the team API tokens, which continue to work independently of SSO",
        terraform:
          'resource "tfe_organization" "this" {\n  name                     = "example"\n  email                    = "platform@example.com"\n  collaborator_auth_policy = "sso"\n}',
        text:
          "Enforce SAML SSO for collaborators, map ownership to an IdP group, keep one monitored break-glass owner, and review team API tokens separately since they bypass SSO.",
      },
      body: `findings = []
for organization in organization_client.organizations.values():
    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=organization,
        resource_name=organization.name,
        resource_id=organization.name,
    )

    policy = (organization.collaborator_auth_policy or "password").lower()

    if organization.sso_enabled and policy == "sso":
        report.status = "PASS"
        report.status_extended = (
            f"Organization {organization.name} requires SSO for collaborators."
        )
    elif organization.sso_enabled:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} has SSO configured but its "
            f"collaborator authentication policy is '{policy}'."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} does not have SSO configured."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_organization_two_factor_conformant",
      service: "organization",
      pillar: "iam",
      severity: "high",
      title: "HCP Terraform organization members are two-factor conformant",
      resourceType: "TerraformCloud::Organization",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "The `two-factor-conformant` attribute reports whether **every member** of the organization has two-factor authentication enabled. This check reports organizations with any non-conformant member.",
      risk:
        "A single member without two-factor authentication is enough to compromise the organization, because Terraform permissions are typically **broad by necessity** — the tooling must be able to create and destroy the resources it manages. An attacker holding one such account can read state containing production credentials and queue applies against live infrastructure.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/users",
        "https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organizations",
      ],
      relatedTo: ["terraformcloud_organization_sso_enforced"],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  \"https://app.terraform.io/api/v2/organizations/<organization>/organization-memberships\"",
        other:
          "1. List organization memberships and identify members without two-factor authentication\n2. Ask them to enable it under **User Settings > Two-factor authentication**\n3. Remove members who no longer need access rather than chasing enrolment\n4. Where SSO is enforced, apply the requirement in the identity provider's conditional access policy so it covers everyone uniformly\n5. Review team API tokens separately — they authenticate without a second factor",
        terraform: "",
        text:
          "Bring every member into two-factor conformance or remove their access, and enforce the requirement in your IdP where SSO is used so it applies uniformly.",
      },
      body: `findings = []
for organization in organization_client.organizations.values():
    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=organization,
        resource_name=organization.name,
        resource_id=organization.name,
    )

    if organization.two_factor_conformant:
        report.status = "PASS"
        report.status_extended = (
            f"All members of organization {organization.name} have two-factor "
            f"authentication enabled."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} has member(s) without two-factor "
            f"authentication enabled."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "terraformcloud_organization_audit_trail_accessible",
      service: "organization",
      pillar: "logging",
      severity: "medium",
      title: "HCP Terraform organizations have an accessible audit trail",
      resourceType: "TerraformCloud::Organization::AuditTrail",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "This check verifies that the organization's **audit trail** API is readable, so runs, variable changes, permission grants and token creation can be exported to a SIEM.",
      risk:
        "The Terraform audit trail is the record of **who changed the infrastructure and what credentials were touched**, and it is retained for a limited period. Without an export, a compromise of the Terraform organization cannot be reconstructed: you cannot establish which state files were read, which variables were altered, or when the attacker's team token was created.",
      urls: [
        "https://developer.hashicorp.com/terraform/cloud-docs/api-docs/audit-trails",
        "https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/organizations",
      ],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $TFC_TOKEN\" \\\n  \"https://app.terraform.io/api/v2/organization/audit-trails\"",
        other:
          "1. Confirm your tier includes audit trail access\n2. Create an organization token with audit trail read permission\n3. Build a scheduled pull of `/api/v2/organization/audit-trails` into your SIEM, or use the HCP audit log streaming integration\n4. Alert on team token creation, variable changes on production workspaces, permission grants and workspace deletion\n5. Retain exported records for at least your investigation window",
        terraform: "",
        text:
          "Export the organization audit trail to your SIEM on a schedule and alert on token creation, production variable changes, permission grants and workspace deletion.",
      },
      body: `findings = []
for organization in organization_client.organizations.values():
    report = CheckReportTerraformCloud(
        metadata=self.metadata(),
        resource=organization,
        resource_name=organization.name,
        resource_id=organization.name,
    )

    if organization.audit_trail_readable:
        report.status = "PASS"
        report.status_extended = (
            f"Organization {organization.name} has a readable audit trail "
            f"available for export."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} audit trail is not readable; "
            f"infrastructure change events cannot be exported."
        )

    findings.append(report)

return findings`,
    },
  ],
};
