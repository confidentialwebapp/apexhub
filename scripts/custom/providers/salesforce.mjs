/** Salesforce — org security settings, users and connected app posture. */

const org_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.salesforce.lib.service.service import SalesforceService


class Org(SalesforceService):
    """Retrieve Salesforce org-wide security settings via the Tooling API."""

    def __init__(self, provider):
        super().__init__("Org", provider)
        self.org: Optional[SalesforceOrg] = None
        self._get_org()

    def _tooling_query(self, soql: str) -> list[dict]:
        """Run a SOQL query against the Tooling API."""
        data = self._get("/services/data/v61.0/tooling/query", params={"q": soql})
        return (data or {}).get("records", [])

    def _get_org(self):
        try:
            org_rows = self._tooling_query(
                "SELECT Id, Name, InstanceName, OrganizationType, IsSandbox "
                "FROM Organization LIMIT 1"
            )
            if not org_rows:
                logger.info("Org - Organization record not readable.")
                return
            org_row = org_rows[0]

            security_rows = self._tooling_query(
                "SELECT SessionSettings, PasswordPolicies, "
                "CanUsersGrantLoginAccess, SessionTimeout "
                "FROM SecuritySettings LIMIT 1"
            )
            settings = security_rows[0] if security_rows else {}
            session_settings = settings.get("SessionSettings") or {}
            password_policies = settings.get("PasswordPolicies") or {}

            ip_ranges = self._tooling_query(
                "SELECT Id, Description, StartAddress, EndAddress FROM IpRange"
            )

            self.org = SalesforceOrg(
                id=org_row.get("Id", ""),
                name=org_row.get("Name", ""),
                instance=org_row.get("InstanceName", ""),
                org_type=org_row.get("OrganizationType", ""),
                is_sandbox=org_row.get("IsSandbox", False),
                session_timeout_minutes=_as_int(settings.get("SessionTimeout")),
                high_assurance_for_setup=bool(
                    session_settings.get("requireHttpOnly", False)
                )
                and bool(session_settings.get("enableUpgradeInsecureRequests", False)),
                lock_sessions_to_ip=bool(
                    session_settings.get("lockSessionsToIp", False)
                ),
                enforce_ip_ranges_in_login=bool(
                    session_settings.get("enforceIpRangesEveryRequest", False)
                ),
                min_password_length=_as_int(
                    password_policies.get("minimumPasswordLength")
                ),
                password_complexity=str(
                    password_policies.get("complexity", "")
                ),
                password_expiration_days=_as_int(
                    password_policies.get("expiration")
                ),
                lockout_attempts=_as_int(
                    password_policies.get("lockoutInterval")
                ),
                login_ip_ranges=[
                    SalesforceIpRange(
                        description=raw.get("Description") or "",
                        start_address=raw.get("StartAddress", ""),
                        end_address=raw.get("EndAddress", ""),
                    )
                    for raw in ip_ranges
                ],
            )
            self._get_monitoring_and_encryption()
            logger.info(f"Org - Read configuration for {self.org.name}")
        except Exception as error:
            logger.error(
                f"Org - Error reading org configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_monitoring_and_encryption(self):
        """Detect Event Monitoring availability and Shield encryption policies."""
        if self.org is None:
            return
        try:
            # EventLogFile is only queryable when Event Monitoring is licensed.
            logs = self._get(
                "/services/data/v61.0/query",
                params={"q": "SELECT Id FROM EventLogFile LIMIT 1"},
            )
            self.org.event_monitoring_enabled = logs is not None

            encrypted = self._tooling_query(
                "SELECT Id, EntityDefinitionId, DeveloperName FROM EncryptedField"
            )
            self.org.encrypted_fields = [
                f"{raw.get('EntityDefinitionId', '')}.{raw.get('DeveloperName', '')}"
                for raw in encrypted
            ]
        except Exception as error:
            logger.error(
                f"Org - Error reading monitoring/encryption configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class SalesforceIpRange(BaseModel):
    """A trusted IP range configured for org login."""

    description: str = ""
    start_address: str = ""
    end_address: str = ""


class SalesforceOrg(BaseModel):
    """Salesforce org representation."""

    id: str
    name: str = ""
    instance: str = ""
    org_type: str = ""
    is_sandbox: bool = False
    session_timeout_minutes: Optional[int] = None
    high_assurance_for_setup: bool = False
    lock_sessions_to_ip: bool = False
    enforce_ip_ranges_in_login: bool = False
    min_password_length: Optional[int] = None
    password_complexity: str = ""
    password_expiration_days: Optional[int] = None
    lockout_attempts: Optional[int] = None
    event_monitoring_enabled: bool = False
    login_ip_ranges: list[SalesforceIpRange] = Field(default_factory=list)
    encrypted_fields: list[str] = Field(default_factory=list)
`;

const user_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.salesforce.lib.service.service import SalesforceService


class User(SalesforceService):
    """Retrieve Salesforce users with their profile, permissions and MFA status."""

    def __init__(self, provider):
        super().__init__("User", provider)
        self.users: dict[str, SalesforceUser] = {}
        self._list_users()
        self._attach_mfa_registration()

    def _query(self, soql: str) -> list[dict]:
        data = self._get("/services/data/v61.0/query", params={"q": soql})
        return (data or {}).get("records", [])

    def _list_users(self):
        try:
            rows = self._query(
                "SELECT Id, Username, Name, IsActive, LastLoginDate, "
                "Profile.Name, Profile.PermissionsModifyAllData, "
                "Profile.PermissionsAuthorApex, Profile.PermissionsManageUsers, "
                "UserType FROM User WHERE IsActive = true"
            )
            for raw in rows:
                profile = raw.get("Profile") or {}
                user = SalesforceUser(
                    id=raw.get("Id", ""),
                    username=raw.get("Username", ""),
                    name=raw.get("Name", ""),
                    is_active=raw.get("IsActive", False),
                    user_type=raw.get("UserType", "Standard"),
                    last_login=raw.get("LastLoginDate"),
                    profile_name=profile.get("Name", ""),
                    modify_all_data=bool(profile.get("PermissionsModifyAllData")),
                    author_apex=bool(profile.get("PermissionsAuthorApex")),
                    manage_users=bool(profile.get("PermissionsManageUsers")),
                )
                self.users[user.id] = user
            logger.info(f"User - Found {len(self.users)} active user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _attach_mfa_registration(self):
        """Mark users that have registered at least one verification method."""
        try:
            rows = self._query(
                "SELECT UserId, Factor FROM TwoFactorMethodsInfo"
            )
            for raw in rows:
                user = self.users.get(raw.get("UserId", ""))
                if user is not None:
                    user.mfa_factors.append(raw.get("Factor", "unknown"))
        except Exception as error:
            logger.error(
                f"User - Error reading MFA registration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SalesforceUser(BaseModel):
    """Salesforce user representation."""

    id: str
    username: str = ""
    name: str = ""
    is_active: bool = False
    user_type: str = "Standard"
    last_login: Optional[str] = None
    profile_name: str = ""
    modify_all_data: bool = False
    author_apex: bool = False
    manage_users: bool = False
    mfa_factors: list[str] = Field(default_factory=list)
`;

const connectedapp_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.salesforce.lib.service.service import SalesforceService


class ConnectedApp(SalesforceService):
    """Retrieve Salesforce connected apps and their OAuth configuration."""

    def __init__(self, provider):
        super().__init__("ConnectedApp", provider)
        self.apps: dict[str, SalesforceConnectedApp] = {}
        self._list_apps()

    def _tooling_query(self, soql: str) -> list[dict]:
        data = self._get("/services/data/v61.0/tooling/query", params={"q": soql})
        return (data or {}).get("records", [])

    def _list_apps(self):
        try:
            rows = self._tooling_query(
                "SELECT Id, Name, OptionsAllowAdminApprovedUsersOnly, "
                "OptionsRefreshTokenValidityMetric, CallbackUrl, Scopes, "
                "OptionsRequireProofKeyForCodeExchange "
                "FROM ConnectedApplication"
            )
            for raw in rows:
                app = SalesforceConnectedApp(
                    id=raw.get("Id", ""),
                    name=raw.get("Name", ""),
                    admin_approved_users_only=bool(
                        raw.get("OptionsAllowAdminApprovedUsersOnly")
                    ),
                    require_pkce=bool(
                        raw.get("OptionsRequireProofKeyForCodeExchange")
                    ),
                    callback_urls=[
                        url.strip()
                        for url in (raw.get("CallbackUrl") or "").split()
                        if url.strip()
                    ],
                    scopes=_parse_scopes(raw.get("Scopes")),
                )
                self.apps[app.id] = app
            logger.info(f"ConnectedApp - Found {len(self.apps)} connected app(s)")
        except Exception as error:
            logger.error(
                f"ConnectedApp - Error listing connected apps: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _parse_scopes(value) -> list[str]:
    if isinstance(value, list):
        return [str(scope) for scope in value]
    if isinstance(value, str):
        return [scope.strip() for scope in value.split(";") if scope.strip()]
    return []


class SalesforceConnectedApp(BaseModel):
    """Salesforce connected app representation."""

    id: str
    name: str = ""
    admin_approved_users_only: bool = False
    require_pkce: bool = False
    callback_urls: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
`;

export default {
  id: "salesforce",
  name: "Salesforce",
  pyClass: "Salesforce",
  baseUrl: "https://login.salesforce.com",
  selfHosted: true,
  samplePath: "/services/data/v61.0/query",
  errorCodeBase: 14700,
  credentialsRemediation:
    "Set SALESFORCE_INSTANCE_URL and SALESFORCE_TOKEN to an OAuth access token for an integration user holding View Setup and Configuration and API Enabled.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Salesforce assesses a Salesforce org across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers multi-factor enrolment, session and password policy, trusted login IP ranges, connected app OAuth scope, administrative profile sprawl, event monitoring and Shield field encryption.",

  services: {
    org: { pyClass: "Org", source: org_service },
    user: { pyClass: "User", source: user_service },
    connectedapp: { pyClass: "ConnectedApp", source: connectedapp_service },
  },

  checks: [
    {
      id: "salesforce_user_mfa_registered",
      service: "user",
      pillar: "iam",
      severity: "critical",
      title: "Salesforce users have a multi-factor verification method registered",
      resourceType: "Salesforce::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that every active Salesforce user has registered at least one **multi-factor verification method** — an authenticator app, security key or built-in authenticator.",
      risk:
        "Salesforce orgs hold the **complete customer record**: contacts, pipeline, contracts and often payment detail. A password-only login is directly usable from anywhere, and credential phishing against Salesforce users is a standing, well-tooled attack because the export capability built into the platform turns one session into a full data set.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.security_require_two-factor_authentication.htm",
        "https://help.salesforce.com/s/articleView?id=sf.mfa_overview.htm",
      ],
      relatedTo: ["salesforce_org_session_settings_hardened"],
      remediation: {
        cli: "",
        other:
          "1. In Setup, go to **Identity > Identity Verification**\n2. Enable **Require multi-factor authentication (MFA) for all direct UI logins**\n3. For profile-scoped enforcement, assign the **Multi-Factor Authentication for User Interface Logins** permission\n4. Give users an enrolment window and monitor registration in the Identity Verification report\n5. Prefer security keys or built-in authenticators over SMS, which is vulnerable to SIM swap\n6. Where users sign in through an external IdP, enforce MFA in that IdP's conditional access policy",
        terraform: "",
        text:
          "Require MFA for all direct UI logins, prefer security keys or built-in authenticators over SMS, and enforce MFA in the upstream IdP for federated users.",
      },
      body: `findings = []
for user in user_client.users.values():
    if not user.is_active:
        continue

    report = CheckReportSalesforce(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.username,
        resource_id=user.id,
    )

    if user.mfa_factors:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.username} has {len(user.mfa_factors)} verification "
            f"method(s) registered: {', '.join(sorted(set(user.mfa_factors)))}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.username} has no multi-factor verification method "
            f"registered."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "salesforce_user_no_excessive_admin_permissions",
      service: "user",
      pillar: "iam",
      severity: "high",
      title: "Salesforce users do not hold excessive administrative permissions",
      resourceType: "Salesforce::User::Profile",
      resourceGroup: "iam",
      categories: ["authentication", "trust-boundaries"],
      description:
        "This check reports active users whose profile grants **Modify All Data**, **Manage Users** or **Author Apex** — permissions that together allow reading every record, creating accounts and deploying executable code.",
      risk:
        "**Modify All Data** overrides every sharing rule, field permission and record ownership control in the org, so a single compromised account with it holds the entire data set regardless of the sharing model. **Author Apex** additionally allows deploying code that runs in system context, giving an attacker a persistent, auditable-looking mechanism to exfiltrate data on a schedule.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.admin_userperms.htm",
        "https://help.salesforce.com/s/articleView?id=sf.users_profiles.htm",
      ],
      relatedTo: ["salesforce_user_mfa_registered"],
      remediation: {
        cli: "",
        other:
          "1. In Setup, run the **Permission Set and Profile** reports to list holders of Modify All Data\n2. For each, determine whether the access is genuinely required\n3. Replace broad profile grants with narrowly scoped **permission sets** assigned only when needed\n4. Use **permission set groups with a muting permission set** to remove specific dangerous permissions from otherwise appropriate roles\n5. Restrict Author Apex to a small named release team\n6. Review the remaining holders on a recurring schedule and require MFA for all of them",
        terraform: "",
        text:
          "Move from broad profile grants to narrowly scoped permission sets, restrict Modify All Data and Author Apex to a small named group, and review holders on a recurring schedule.",
      },
      body: `findings = []
for user in user_client.users.values():
    if not user.is_active:
        continue
    # Integration users are assessed separately; this check targets human logins.
    if user.user_type not in ("Standard", "PowerPartner", "CsnOnly"):
        continue

    report = CheckReportSalesforce(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.username,
        resource_id=user.id,
    )

    granted = []
    if user.modify_all_data:
        granted.append("Modify All Data")
    if user.manage_users:
        granted.append("Manage Users")
    if user.author_apex:
        granted.append("Author Apex")

    if granted:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.username} (profile {user.profile_name}) holds "
            f"{', '.join(granted)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.username} (profile {user.profile_name}) holds no "
            f"excessive administrative permissions."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "salesforce_org_password_policy_strong",
      service: "org",
      pillar: "iam",
      severity: "high",
      title: "Salesforce orgs enforce a strong password policy",
      resourceType: "Salesforce::Org::PasswordPolicy",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the org's password policy requires a minimum length of at least 12 characters, mixed character complexity, and account lockout after a bounded number of failed attempts.",
      risk:
        "Salesforce login endpoints are **publicly reachable and continuously targeted** by credential stuffing, so a weak minimum length or an unbounded retry count makes automated guessing practical. Because a successful login grants export capability over the customer record, the cost of a single guessed password is disproportionate to the effort required.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.admin_password.htm",
        "https://help.salesforce.com/s/articleView?id=sf.security_overview_passwords.htm",
      ],
      relatedTo: ["salesforce_user_mfa_registered"],
      remediation: {
        cli: "",
        other:
          "1. In Setup, go to **Security > Password Policies**\n2. Set **Minimum password length** to 12 or more\n3. Set **Password complexity requirement** to require letters, numbers and special characters\n4. Set **Maximum invalid login attempts** to 5 or fewer with a lockout period\n5. Configure **Password question requirement** to disallow the password itself\n6. Note that a strong password policy complements but does not replace MFA — configure both",
        terraform: "",
        text:
          "Require at least 12 characters with mixed complexity, lock accounts after a small number of failed attempts, and pair the policy with enforced MFA.",
      },
      body: `min_length_required = self.audit_config.get("min_password_length", 12)
max_lockout_attempts = self.audit_config.get("max_invalid_login_attempts", 5)

findings = []
org = org_client.org
if org is None:
    return findings

report = CheckReportSalesforce(
    metadata=self.metadata(),
    resource=org,
    resource_name=org.name,
    resource_id=org.id,
)

issues = []
if (org.min_password_length or 0) < min_length_required:
    issues.append(
        f"minimum length is {org.min_password_length or 'unset'} "
        f"(expected {min_length_required})"
    )
if not org.password_complexity or org.password_complexity.lower() in ("nore", "none"):
    issues.append("no character complexity requirement")
if org.lockout_attempts is None or org.lockout_attempts > max_lockout_attempts:
    issues.append(
        f"lockout after {org.lockout_attempts or 'unlimited'} attempts "
        f"(expected {max_lockout_attempts} or fewer)"
    )

if issues:
    report.status = "FAIL"
    report.status_extended = (
        f"Org {org.name} password policy is weak: {'; '.join(issues)}."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Org {org.name} enforces a password policy with a minimum length of "
        f"{org.min_password_length} and lockout after {org.lockout_attempts} "
        f"attempts."
    )

findings.append(report)
return findings`,
    },

    {
      id: "salesforce_org_session_settings_hardened",
      service: "org",
      pillar: "iam",
      severity: "high",
      title: "Salesforce orgs harden session settings",
      resourceType: "Salesforce::Org::SessionSettings",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the org locks sessions to the originating IP address and applies a session timeout no longer than the configured maximum (two hours by default).",
      risk:
        "A Salesforce session ID that is not bound to its originating address can be **replayed from anywhere** once stolen through a malicious browser extension, an XSS flaw in a Visualforce page, or a phishing proxy. Long timeouts widen that replay window considerably, and because sessions survive password changes, revocation during an incident is slower than administrators expect.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.admin_sessions.htm",
        "https://help.salesforce.com/s/articleView?id=sf.security_overview_sessions.htm",
      ],
      relatedTo: ["salesforce_org_login_ip_ranges_configured"],
      remediation: {
        cli: "",
        other:
          "1. In Setup, go to **Security > Session Settings**\n2. Set **Timeout value** to 2 hours or less and enable **Force logout on session timeout**\n3. Enable **Lock sessions to the IP address from which they originated**\n4. Enable **Require secure connections (HTTPS)**\n5. Enable **Force relogin after Login-As-User**\n6. Test with users behind rotating egress addresses before enforcing IP locking — some VPN configurations break it",
        terraform: "",
        text:
          "Lock sessions to their originating IP, cap the session timeout at two hours with forced logout, and require HTTPS — testing IP locking against rotating VPN egress before enforcement.",
      },
      body: `max_timeout_minutes = self.audit_config.get("max_session_timeout_minutes", 120)

findings = []
org = org_client.org
if org is None:
    return findings

report = CheckReportSalesforce(
    metadata=self.metadata(),
    resource=org,
    resource_name=org.name,
    resource_id=org.id,
)

issues = []
if not org.lock_sessions_to_ip:
    issues.append("sessions are not locked to their originating IP address")
timeout = org.session_timeout_minutes
if timeout is None or timeout > max_timeout_minutes:
    issues.append(
        f"session timeout is {timeout or 'unset'} minutes "
        f"(expected {max_timeout_minutes} or fewer)"
    )

if issues:
    report.status = "FAIL"
    report.status_extended = f"Org {org.name} session settings: {'; '.join(issues)}."
else:
    report.status = "PASS"
    report.status_extended = (
        f"Org {org.name} locks sessions to their originating IP address with a "
        f"{timeout} minute timeout."
    )

findings.append(report)
return findings`,
    },

    {
      id: "salesforce_org_login_ip_ranges_configured",
      service: "org",
      pillar: "attacksurface",
      severity: "medium",
      title: "Salesforce orgs restrict login to trusted IP ranges",
      resourceType: "Salesforce::Org::IpRange",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "This check verifies that the org defines **trusted login IP ranges**, and reports ranges so wide that they provide no meaningful restriction.",
      risk:
        "Without login IP ranges, a phished credential is usable **immediately from the attacker's own infrastructure**, and the identity verification challenge that would otherwise fire for an unrecognised address can be satisfied by the same phishing proxy that captured the password. Network scoping breaks that chain at a layer the phishing kit cannot relay.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.admin_loginrestrict.htm",
        "https://help.salesforce.com/s/articleView?id=sf.security_networkaccess.htm",
      ],
      relatedTo: ["salesforce_org_session_settings_hardened"],
      remediation: {
        cli: "",
        other:
          "1. In Setup, go to **Security > Network Access**\n2. Add the egress ranges for your offices, VPN and integration middleware as trusted IP ranges\n3. For stricter control, set **Login IP Ranges** on individual profiles, which blocks login outright rather than only skipping verification\n4. Verify integration users are covered before enforcing, or scheduled jobs will fail\n5. Keep the ranges as narrow as your network allows and review them when egress changes",
        terraform: "",
        text:
          "Define trusted IP ranges for the org and profile-level login IP ranges for privileged profiles, keeping them narrow and confirming integration egress is covered first.",
      },
      body: `import ipaddress

findings = []
org = org_client.org
if org is None:
    return findings

report = CheckReportSalesforce(
    metadata=self.metadata(),
    resource=org,
    resource_name=org.name,
    resource_id=org.id,
)

if not org.login_ip_ranges:
    report.status = "FAIL"
    report.status_extended = (
        f"Org {org.name} defines no trusted login IP ranges."
    )
    findings.append(report)
    return findings

# A range covering more than a /16 offers little practical restriction.
max_range_size = 65536
broad = []
for entry in org.login_ip_ranges:
    try:
        start = int(ipaddress.ip_address(entry.start_address))
        end = int(ipaddress.ip_address(entry.end_address))
    except ValueError:
        continue
    if end - start + 1 > max_range_size:
        broad.append(f"{entry.start_address}-{entry.end_address}")

if broad:
    report.status = "FAIL"
    report.status_extended = (
        f"Org {org.name} defines trusted login IP range(s) that are over-broad: "
        f"{', '.join(broad)}."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Org {org.name} restricts login to {len(org.login_ip_ranges)} scoped IP "
        f"range(s)."
    )

findings.append(report)
return findings`,
    },

    {
      id: "salesforce_connectedapp_oauth_scopes_least_privilege",
      service: "connectedapp",
      pillar: "iam",
      severity: "high",
      title: "Salesforce connected apps request least-privilege OAuth scopes",
      resourceType: "Salesforce::ConnectedApp",
      resourceGroup: "iam",
      categories: ["trust-boundaries", "authentication"],
      description:
        "This check reports connected apps requesting the **full**, **refresh_token** with unrestricted access, or **web** scopes without restricting which users may authorise them, and apps whose callback URLs are not exact HTTPS endpoints.",
      risk:
        "The `full` scope grants a third-party application **everything the authorising user can do**, including exporting the entire customer record, and the accompanying refresh token makes that access indefinite and survivable across password resets. Connected apps are also a favoured persistence mechanism: an attacker who authorises one retains access long after the compromised session is closed.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm",
        "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_tokens_scopes.htm",
      ],
      remediation: {
        cli: "",
        other:
          "1. In Setup, go to **Apps > Connected Apps > Manage Connected Apps**\n2. Review the OAuth scopes each app requests and remove `full` where a narrower scope suffices\n3. Set **Permitted Users** to `Admin approved users are pre-authorized` and assign only the profiles that need it\n4. Enable **Require Proof Key for Code Exchange (PKCE)**\n5. Set callback URLs to exact HTTPS endpoints — no wildcards, no HTTP\n6. Revoke apps that are no longer in use, which also invalidates their refresh tokens",
        terraform: "",
        text:
          "Replace the full scope with narrow ones, pre-authorise apps to named profiles only, require PKCE, use exact HTTPS callback URLs, and revoke unused apps to invalidate their refresh tokens.",
      },
      body: `BROAD_SCOPES = {"full", "refresh_token", "offline_access", "web", "api"}

findings = []
for app in connectedapp_client.apps.values():
    report = CheckReportSalesforce(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name,
        resource_id=app.id,
    )

    scopes = {scope.strip().lower() for scope in app.scopes}
    issues = []

    if "full" in scopes:
        issues.append("requests the 'full' scope")
    elif scopes & BROAD_SCOPES and not app.admin_approved_users_only:
        issues.append(
            f"requests {', '.join(sorted(scopes & BROAD_SCOPES))} without "
            f"restricting authorisation to admin-approved users"
        )

    insecure_callbacks = [
        url
        for url in app.callback_urls
        if not url.startswith("https://") or "*" in url
    ]
    if insecure_callbacks:
        issues.append(
            f"has non-exact or insecure callback URL(s): "
            f"{', '.join(insecure_callbacks)}"
        )

    if issues:
        report.status = "FAIL"
        report.status_extended = f"Connected app {app.name} {'; '.join(issues)}."
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Connected app {app.name} requests scoped OAuth permissions with "
            f"exact HTTPS callback URLs."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "salesforce_org_event_monitoring_enabled",
      service: "org",
      pillar: "logging",
      severity: "medium",
      title: "Salesforce orgs have Event Monitoring enabled",
      resourceType: "Salesforce::Org::EventLogFile",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "**Event Monitoring** exposes login, API, report export and Apex execution events as downloadable log files. This check verifies that `EventLogFile` is queryable, indicating the capability is licensed and available.",
      risk:
        "Without Event Monitoring there is **no record of data export**: the setup audit trail captures configuration changes but not who ran which report or pulled which records through the API. That is precisely the evidence needed to scope a data breach, and its absence turns an investigation into guesswork about what an attacker actually took.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.real_time_event_monitoring_overview.htm",
        "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_event_log_file.htm",
      ],
      remediation: {
        cli: "",
        other:
          "1. Confirm your edition includes Event Monitoring, or add the Salesforce Shield licence\n2. Enable **Real-Time Event Monitoring** in Setup > Event Manager for the events you need, particularly ReportEvent, ApiEvent and LoginEvent\n3. Configure a scheduled job or the Event Monitoring Analytics app to pull EventLogFile daily into your SIEM\n4. Alert on large report exports, API access from unrecognised addresses and Login-As-User events\n5. Add **Transaction Security Policies** to block the highest-risk actions rather than only recording them",
        terraform: "",
        text:
          "Enable Real-Time Event Monitoring, pull EventLogFile into your SIEM daily, alert on bulk exports and unusual API access, and add transaction security policies to block the worst cases outright.",
      },
      body: `findings = []
org = org_client.org
if org is None:
    return findings

report = CheckReportSalesforce(
    metadata=self.metadata(),
    resource=org,
    resource_name=org.name,
    resource_id=org.id,
)

if org.event_monitoring_enabled:
    report.status = "PASS"
    report.status_extended = f"Org {org.name} has Event Monitoring available."
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Org {org.name} does not have Event Monitoring available; data export "
        f"and API activity are not recorded."
    )

findings.append(report)
return findings`,
    },

    {
      id: "salesforce_org_shield_platform_encryption_configured",
      service: "org",
      pillar: "encryption",
      severity: "medium",
      title: "Salesforce orgs encrypt sensitive fields with Shield Platform Encryption",
      resourceType: "Salesforce::Org::EncryptedField",
      resourceGroup: "storage",
      categories: ["encryption", "data-protection"],
      description:
        "**Shield Platform Encryption** encrypts field data at rest while preserving platform functionality, using a tenant secret you can rotate and destroy. This check reports orgs with no encrypted fields configured.",
      risk:
        "Salesforce's default at-rest encryption is transparent to the platform, so it offers **no protection against an authenticated attacker or an over-permissioned integration** reading the data. Shield encryption additionally gives you a tenant secret you control, which is what makes crypto-shredding — destroying the key to render data unrecoverable — possible at all.",
      urls: [
        "https://help.salesforce.com/s/articleView?id=sf.security_pe_overview.htm",
        "https://help.salesforce.com/s/articleView?id=sf.security_pe_considerations.htm",
      ],
      remediation: {
        cli: "",
        other:
          "1. Confirm the org has the Salesforce Shield or Platform Encryption licence\n2. In Setup, go to **Security > Platform Encryption > Key Management** and generate a tenant secret\n3. Under **Encryption Policy**, encrypt the fields holding regulated data — national identifiers, payment references, health information\n4. Review the documented functional trade-offs first: some filtering, sorting and formula behaviour changes on encrypted fields\n5. Consider **Bring Your Own Key** so the tenant secret is derived from key material you hold\n6. Establish a tenant secret rotation schedule",
        terraform: "",
        text:
          "Encrypt fields holding regulated data with Shield Platform Encryption, review the functional trade-offs before rollout, and consider Bring Your Own Key with a documented rotation schedule.",
      },
      body: `findings = []
org = org_client.org
if org is None:
    return findings

report = CheckReportSalesforce(
    metadata=self.metadata(),
    resource=org,
    resource_name=org.name,
    resource_id=org.id,
)

if org.encrypted_fields:
    report.status = "PASS"
    report.status_extended = (
        f"Org {org.name} encrypts {len(org.encrypted_fields)} field(s) with Shield "
        f"Platform Encryption."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Org {org.name} has no fields encrypted with Shield Platform Encryption."
    )

findings.append(report)
return findings`,
    },
  ],
};
