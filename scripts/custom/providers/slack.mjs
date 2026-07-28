/** Slack — workspace authentication, app governance and retention posture. */

const workspace_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class Workspace(SlackService):
    """Retrieve Slack workspace and enterprise settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspace: Optional[SlackWorkspace] = None
        self._get_workspace()

    def _get_workspace(self):
        try:
            team = (self._get("/api/team.info") or {}).get("team", {})
            prefs = (self._get("/api/team.preferences.list") or {})
            # Audit logs are Enterprise Grid only; a readable page confirms access.
            audit = self._get("/api/audit/v1/logs", params={"limit": 1})

            self.workspace = SlackWorkspace(
                id=team.get("id", ""),
                name=team.get("name", ""),
                domain=team.get("domain", ""),
                email_domain=team.get("email_domain", ""),
                enterprise_id=team.get("enterprise_id"),
                sso_required=bool(prefs.get("sso_required", False)),
                two_factor_required=bool(
                    prefs.get("two_factor_auth_required", False)
                ),
                app_approval_required=bool(
                    prefs.get("app_management_approval_required", False)
                ),
                who_can_manage_apps=str(prefs.get("who_can_manage_apps", "")),
                message_retention_days=_as_int(prefs.get("msg_retention_duration")),
                file_retention_days=_as_int(prefs.get("file_retention_duration")),
                audit_logs_readable=audit is not None,
                enterprise_key_management=bool(prefs.get("ekm_enabled", False)),
            )
            logger.info(f"Workspace - Read configuration for {self.workspace.name}")
        except Exception as error:
            logger.error(
                f"Workspace - Error reading workspace configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class SlackWorkspace(BaseModel):
    """Slack workspace representation."""

    id: str
    name: str = ""
    domain: str = ""
    email_domain: str = ""
    enterprise_id: Optional[str] = None
    sso_required: bool = False
    two_factor_required: bool = False
    app_approval_required: bool = False
    who_can_manage_apps: str = ""
    message_retention_days: Optional[int] = None
    file_retention_days: Optional[int] = None
    audit_logs_readable: bool = False
    enterprise_key_management: bool = False
`;

const app_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class App(SlackService):
    """Retrieve installed Slack apps with their granted OAuth scopes."""

    def __init__(self, provider):
        super().__init__("App", provider)
        self.apps: dict[str, SlackApp] = {}
        self._list_apps()

    def _list_apps(self):
        try:
            data = self._get("/api/admin.apps.approved.list", params={"limit": 200})
            approved = (data or {}).get("approved_apps", [])
            for entry in approved:
                self._add_app(entry, approved=True)

            data = self._get("/api/admin.apps.restricted.list", params={"limit": 200})
            for entry in (data or {}).get("restricted_apps", []):
                self._add_app(entry, approved=False)

            logger.info(f"App - Found {len(self.apps)} installed app(s)")
        except Exception as error:
            logger.error(
                f"App - Error listing apps: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _add_app(self, entry: dict, approved: bool):
        raw = entry.get("app") or {}
        app = SlackApp(
            id=raw.get("id", ""),
            name=raw.get("name", ""),
            is_approved=approved,
            is_internal=bool(raw.get("is_app_directory_approved") is False),
            app_directory_approved=bool(raw.get("is_app_directory_approved", False)),
            scopes=[
                scope.get("name", "")
                for scope in raw.get("scopes", [])
                if isinstance(scope, dict)
            ]
            or list(raw.get("scopes", []) if isinstance(raw.get("scopes"), list) else []),
            installed_by=(entry.get("last_resolved_by") or {}).get("actor_id", ""),
        )
        if app.id:
            self.apps[app.id] = app


class SlackApp(BaseModel):
    """Slack installed app representation."""

    id: str
    name: str = ""
    is_approved: bool = False
    is_internal: bool = False
    app_directory_approved: bool = False
    scopes: list[str] = Field(default_factory=list)
    installed_by: str = ""
`;

const channel_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class Channel(SlackService):
    """Retrieve Slack conversations with their sharing and visibility state."""

    def __init__(self, provider):
        super().__init__("Channel", provider)
        self.channels: dict[str, SlackChannel] = {}
        self._list_channels()

    def _list_channels(self):
        try:
            cursor = None
            while True:
                params = {"limit": 200, "types": "public_channel,private_channel"}
                if cursor:
                    params["cursor"] = cursor

                data = self._get("/api/conversations.list", params=params)
                if data is None:
                    break

                for raw in data.get("channels", []):
                    channel = SlackChannel(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        is_private=raw.get("is_private", False),
                        is_archived=raw.get("is_archived", False),
                        is_shared=raw.get("is_shared", False),
                        is_ext_shared=raw.get("is_ext_shared", False),
                        is_org_shared=raw.get("is_org_shared", False),
                        num_members=raw.get("num_members", 0),
                    )
                    self.channels[channel.id] = channel

                cursor = (data.get("response_metadata") or {}).get("next_cursor")
                if not cursor:
                    break

            logger.info(f"Channel - Found {len(self.channels)} channel(s)")
        except Exception as error:
            logger.error(
                f"Channel - Error listing channels: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SlackChannel(BaseModel):
    """Slack conversation representation."""

    id: str
    name: str = ""
    is_private: bool = False
    is_archived: bool = False
    is_shared: bool = False
    is_ext_shared: bool = False
    is_org_shared: bool = False
    num_members: int = 0
`;

export default {
  id: "slack",
  name: "Slack",
  pyClass: "Slack",
  baseUrl: "https://slack.com",
  samplePath: "/api/team.info",
  errorCodeBase: 14800,
  credentialsRemediation:
    "Set SLACK_TOKEN to a workspace or organization token with admin.apps:read, admin.conversations:read, team:read and auditlogs:read scopes.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Slack assesses a Slack workspace across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers SSO and two-factor enforcement, third-party app approval and OAuth scope, externally shared channels, message and file retention, and enterprise key management.",

  services: {
    workspace: { pyClass: "Workspace", source: workspace_service },
    app: { pyClass: "App", source: app_service },
    channel: { pyClass: "Channel", source: channel_service },
  },

  checks: [
    {
      id: "slack_workspace_sso_required",
      service: "workspace",
      pillar: "iam",
      severity: "critical",
      title: "Slack workspaces require SSO for member sign-in",
      resourceType: "Slack::Workspace",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the workspace requires **single sign-on**, so membership and session control follow the corporate identity provider rather than Slack-local passwords.",
      risk:
        "Slack accumulates an organisation's most sensitive informal record: **credentials pasted into DMs, incident detail, contract discussion and internal architecture**. Without enforced SSO there is no conditional access and no central session revocation, so a leaver or a phished account retains a searchable archive of all of it until someone manually intervenes.",
      urls: [
        "https://slack.com/help/articles/203772216-SAML-single-sign-on",
        "https://api.slack.com/methods/team.info",
      ],
      relatedTo: ["slack_workspace_two_factor_required"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Slack as a workspace or org owner\n2. Go to **Settings & administration > Workspace settings > Authentication**\n3. Configure the SAML connection to your identity provider\n4. Set SSO to **Required** for all members\n5. Enable SCIM provisioning so deactivation in the IdP removes Slack access automatically\n6. Decide explicitly whether guests are exempt, and document the exception",
        terraform: "",
        text:
          "Require SAML SSO for all members and enable SCIM provisioning so deprovisioning is automatic rather than dependent on manual offboarding steps.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

if workspace.sso_required:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} requires SSO for member sign-in."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} does not require SSO for member sign-in."
    )

findings.append(report)
return findings`,
    },

    {
      id: "slack_workspace_two_factor_required",
      service: "workspace",
      pillar: "iam",
      severity: "high",
      title: "Slack workspaces require two-factor authentication",
      resourceType: "Slack::Workspace",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the workspace requires **two-factor authentication** for members who sign in with a Slack password, which applies wherever SSO is not enforced.",
      risk:
        "Where SSO is not required, a Slack password is the **only barrier to a fully searchable message history**, including any credential a colleague pasted into a channel. Slack account takeover is also a favoured route for internal phishing, because a message from a trusted colleague's real account bypasses the scepticism an external email would attract.",
      urls: [
        "https://slack.com/help/articles/204509068-Set-up-two-factor-authentication",
        "https://api.slack.com/methods/team.info",
      ],
      relatedTo: ["slack_workspace_sso_required"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Slack as a workspace owner or admin\n2. Go to **Settings & administration > Workspace settings > Authentication**\n3. Enable **Require two-factor authentication for everyone**\n4. Notify members before enforcing, since those without 2FA are signed out until they enrol\n5. Prefer an authenticator app over SMS, which is vulnerable to SIM swap\n6. Where SSO is enforced, apply the equivalent requirement in the identity provider instead",
        terraform: "",
        text:
          "Require two-factor authentication for all password-based sign-ins, preferring authenticator apps over SMS, and enforce the equivalent policy in your IdP where SSO is used.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

# SSO delegates the factor policy to the identity provider.
if workspace.two_factor_required or workspace.sso_required:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} requires two-factor authentication"
        f"{' through the federated identity provider' if not workspace.two_factor_required else ''}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} does not require two-factor authentication."
    )

findings.append(report)
return findings`,
    },

    {
      id: "slack_workspace_app_approval_required",
      service: "workspace",
      pillar: "attacksurface",
      severity: "high",
      title: "Slack workspaces require admin approval before app installation",
      resourceType: "Slack::Workspace",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "This check verifies that **app approval** is enabled and that app management is restricted to admins, so third-party integrations cannot be installed by any member without review.",
      risk:
        "A Slack app authorised by an ordinary member can hold scopes that read **every message in every channel it is added to**, and that access continues silently long after whoever installed it has forgotten about it. Malicious and abandoned apps in the directory are a recurring problem, and without approval gating your review happens after the data has already left.",
      urls: [
        "https://slack.com/help/articles/222386767-Manage-app-installation-settings-for-your-workspace",
        "https://api.slack.com/methods/admin.apps.approved.list",
      ],
      relatedTo: ["slack_app_oauth_scopes_least_privilege"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Slack as a workspace owner or admin\n2. Go to **Settings & administration > Manage apps > App management settings**\n3. Enable **Require App Approval**\n4. Restrict app installation to admins\n5. Review the apps already installed and restrict any that are unrecognised or no longer used\n6. Maintain an allowlist of reviewed apps so approval does not become a bottleneck",
        terraform: "",
        text:
          "Require admin approval for app installation, restrict app management to admins, and audit the apps already installed — an approval gate does not retroactively review them.",
      },
      body: `ADMIN_ONLY = {"admins", "owners", "admins_and_owners", "admin"}

findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

restricted = workspace.who_can_manage_apps.lower() in ADMIN_ONLY

if workspace.app_approval_required and restricted:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} requires app approval and restricts app "
        f"management to administrators."
    )
elif workspace.app_approval_required:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} requires app approval but app management is "
        f"open to '{workspace.who_can_manage_apps or 'unknown'}'."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} does not require admin approval before app "
        f"installation."
    )

findings.append(report)
return findings`,
    },

    {
      id: "slack_app_oauth_scopes_least_privilege",
      service: "app",
      pillar: "iam",
      severity: "high",
      title: "Slack apps do not hold workspace-wide message read scopes",
      resourceType: "Slack::App",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "This check reports installed apps holding broad scopes such as `channels:history`, `groups:history`, `files:read` or any `admin.*` scope, which grant access far beyond a single channel's interaction.",
      risk:
        "A `history` scope lets an app read the **complete message archive of every conversation it can see**, not just messages that mention it, so one compromised vendor becomes a full export of your internal discussion. `admin.*` scopes go further still, allowing the app to change workspace settings and manage other apps — a self-sustaining foothold.",
      urls: [
        "https://api.slack.com/scopes",
        "https://slack.com/help/articles/222386767-Manage-app-installation-settings-for-your-workspace",
      ],
      relatedTo: ["slack_workspace_app_approval_required"],
      remediation: {
        cli: "",
        other:
          "1. Go to **Settings & administration > Manage apps**\n2. Open each app and review its granted scopes\n3. Remove apps holding history or admin scopes that they do not demonstrably need\n4. Where an app must read messages, restrict it to specific channels rather than the workspace\n5. Prefer apps that use Slack Connect or narrow event subscriptions over polling history\n6. Re-review app scopes when an app updates, since new versions can request additional permissions",
        terraform: "",
        text:
          "Remove apps holding workspace-wide history or admin scopes unless clearly justified, scope message access to specific channels, and re-review scopes when apps update.",
      },
      body: `BROAD_SCOPES = {
    "channels:history",
    "groups:history",
    "im:history",
    "mpim:history",
    "files:read",
    "search:read",
    "users:read.email",
}

findings = []
for app in app_client.apps.values():
    report = CheckReportSlack(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name or app.id,
        resource_id=app.id,
    )

    scopes = {scope.strip().lower() for scope in app.scopes if scope}
    admin_scopes = {scope for scope in scopes if scope.startswith("admin")}
    broad = (scopes & BROAD_SCOPES) | admin_scopes

    if broad:
        report.status = "FAIL"
        report.status_extended = (
            f"App {app.name or app.id} holds broad scope(s): "
            f"{', '.join(sorted(broad))}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"App {app.name or app.id} holds {len(scopes)} scoped permission(s) "
            f"with no workspace-wide message or admin access."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "slack_channel_external_sharing_reviewed",
      service: "channel",
      pillar: "attacksurface",
      severity: "medium",
      title: "Slack channels shared externally are private and actively used",
      resourceType: "Slack::Channel",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "This check reports **externally shared** (Slack Connect) channels that are public within the workspace, and external channels left unarchived with no members, both of which extend a trust boundary beyond what anyone is actively managing.",
      risk:
        "An externally shared channel gives another organisation's members a **live view into your workspace**, and when the channel is also public internally, anyone who joins it — including a newly compromised account — is exposed to that external party. Forgotten Connect channels from ended engagements are the common case: the counterparty retains access long after the commercial relationship stops.",
      urls: [
        "https://slack.com/help/articles/115004151203-Slack-Connect-guide",
        "https://api.slack.com/methods/conversations.list",
      ],
      remediation: {
        cli: "",
        other:
          "1. Go to **Settings & administration > Manage organization > Channels** and filter to externally shared channels\n2. Confirm each still corresponds to an active engagement\n3. Convert externally shared channels to private so membership is deliberate\n4. Archive or disconnect channels for finished engagements — disconnecting revokes the external party's access to history\n5. Restrict who may create Slack Connect invitations to admins\n6. Add the review to your vendor offboarding checklist",
        terraform: "",
        text:
          "Keep externally shared channels private, disconnect them when an engagement ends, restrict who may send Connect invitations, and add the review to vendor offboarding.",
      },
      body: `findings = []
for channel in channel_client.channels.values():
    if not (channel.is_ext_shared or channel.is_shared):
        continue
    if channel.is_archived:
        continue

    report = CheckReportSlack(
        metadata=self.metadata(),
        resource=channel,
        resource_name=channel.name or channel.id,
        resource_id=channel.id,
    )

    issues = []
    if channel.is_ext_shared and not channel.is_private:
        issues.append("is shared externally but public within the workspace")
    if channel.num_members == 0:
        issues.append("has no members but remains connected")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Channel #{channel.name} {' and '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Channel #{channel.name} is externally shared, private, and has "
            f"{channel.num_members} member(s)."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "slack_workspace_retention_policy_configured",
      service: "workspace",
      pillar: "logging",
      severity: "medium",
      title: "Slack workspaces configure message and file retention",
      resourceType: "Slack::Workspace",
      resourceGroup: "storage",
      categories: ["logging", "data-protection"],
      description:
        "This check verifies that the workspace sets an explicit **message and file retention** period rather than retaining everything indefinitely by default.",
      risk:
        "Slack's default is to keep messages and files **forever**, so the workspace accumulates years of pasted credentials, customer data and confidential discussion that no policy ever authorised retaining. A single account compromise then exposes the organisation's entire history rather than its recent activity, and the archive becomes discoverable in litigation regardless of business need.",
      urls: [
        "https://slack.com/help/articles/203457187-Customize-message-and-file-retention-policies",
        "https://slack.com/help/articles/115002579323-Understand-data-retention-in-Slack",
      ],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Slack as a workspace owner\n2. Go to **Settings & administration > Workspace settings > Message retention & deletion**\n3. Set a retention period that matches your records policy — commonly 1 to 2 years for general channels\n4. Set file retention separately; files are often the higher exposure\n5. Decide whether channel owners may override the default, and restrict it if not\n6. Where regulation requires longer retention, export to a governed archive rather than leaving data in Slack indefinitely",
        terraform: "",
        text:
          "Set explicit message and file retention matching your records policy, restrict per-channel overrides, and export to a governed archive where regulation requires longer retention.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

message_days = workspace.message_retention_days
file_days = workspace.file_retention_days

missing = []
if not message_days:
    missing.append("messages")
if not file_days:
    missing.append("files")

if missing:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} retains {' and '.join(missing)} indefinitely."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} retains messages for {message_days} day(s) "
        f"and files for {file_days} day(s)."
    )

findings.append(report)
return findings`,
    },

    {
      id: "slack_workspace_audit_logs_accessible",
      service: "workspace",
      pillar: "logging",
      severity: "medium",
      title: "Slack organizations have audit logs available for export",
      resourceType: "Slack::Workspace::AuditLog",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "This check verifies that the **Audit Logs API** is readable for the organization, indicating that administrative and access events can be exported to a SIEM.",
      risk:
        "Without audit log access there is **no record of app installations, permission changes, file downloads or Slack Connect invitations**. Those are exactly the events that distinguish an account compromise from normal use, so their absence means an intrusion is typically discovered only when its effects surface elsewhere.",
      urls: [
        "https://api.slack.com/admins/audit-logs",
        "https://slack.com/help/articles/360002079527-Slack-Enterprise-Grid-audit-logs",
      ],
      remediation: {
        cli: "curl 'https://api.slack.com/audit/v1/logs?limit=100' \\\n  -H \"Authorization: Bearer $SLACK_TOKEN\"",
        other:
          "1. Confirm the organization is on a plan that includes the Audit Logs API\n2. Create an app with the `auditlogs:read` scope and install it at the org level\n3. Build or enable a scheduled pull of `/audit/v1/logs` into your SIEM\n4. Alert on `app_installed`, `app_scopes_expanded`, `file_downloaded` in bulk, `user_channel_join` to sensitive channels and Slack Connect invitations\n5. Retain the exported events for at least your investigation window",
        terraform: "",
        text:
          "Enable the Audit Logs API, pull events into your SIEM on a schedule, and alert on app installations, scope expansions, bulk downloads and Slack Connect invitations.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

if workspace.audit_logs_readable:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} has audit logs available for export."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} has no readable audit log; administrative and "
        f"access events cannot be exported."
    )

findings.append(report)
return findings`,
    },

    {
      id: "slack_workspace_enterprise_key_management_enabled",
      service: "workspace",
      pillar: "encryption",
      severity: "low",
      title: "Slack Enterprise Grid organizations use enterprise key management",
      resourceType: "Slack::Workspace",
      resourceGroup: "storage",
      categories: ["encryption", "data-protection"],
      description:
        "**Enterprise Key Management** encrypts Slack messages and files with a customer-managed key held in your own cloud KMS. This check reports Enterprise Grid organizations that have not enabled it; standalone workspaces where the feature is unavailable are skipped.",
      risk:
        "With platform-managed keys only, you cannot **independently revoke access to your message history** — containment during a suspected platform incident depends entirely on the provider acting. Customer-managed keys also let you revoke access at channel or workspace granularity and give you the key-usage audit trail that regulated programmes expect.",
      urls: [
        "https://slack.com/help/articles/360019110974-Slack-Enterprise-Key-Management",
        "https://slack.com/enterprise-key-management",
      ],
      remediation: {
        cli: "",
        other:
          "1. Confirm the organization is on Enterprise Grid with the EKM add-on\n2. Create a KMS key in your own cloud account\n3. Grant Slack the minimum key usage permissions required\n4. Enable EKM in the organization settings and select the channels or workspaces to cover\n5. Enable key rotation and monitor key usage in your cloud audit log\n6. Document the revocation runbook, including who is authorised to revoke and what it makes inaccessible",
        terraform: "",
        text:
          "Enable Enterprise Key Management with a key in your own KMS, monitor key usage in your cloud audit log, and document a revocation runbook before you need it.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

# EKM is an Enterprise Grid capability; standalone workspaces cannot enable it.
if not workspace.enterprise_id:
    return findings

report = CheckReportSlack(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.name or workspace.id,
    resource_id=workspace.id,
)

if workspace.enterprise_key_management:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.name} uses enterprise key management."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.name} is on Enterprise Grid but does not use "
        f"enterprise key management."
    )

findings.append(report)
return findings`,
    },
  ],
};
