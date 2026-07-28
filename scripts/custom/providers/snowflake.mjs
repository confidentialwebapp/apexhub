/** Snowflake — data platform account, identity and network posture. */

// Snowflake exposes its security posture through SQL (SHOW commands and the
// ACCOUNT_USAGE schema) rather than a REST API, so the service base wraps the
// Snowflake connector instead of an HTTP session.
const service_base = `from concurrent.futures import ThreadPoolExecutor, as_completed

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.exceptions.exceptions import (
    SnowflakeAPIError,
    SnowflakeRateLimitError,
)

MAX_WORKERS = 5


class SnowflakeService:
    """Base class for Snowflake services: shared connection and query helpers."""

    def __init__(self, service: str, provider):
        self.provider = provider
        self.audit_config = provider.audit_config
        self.fixer_config = provider.fixer_config
        self.service = service.lower() if not service.islower() else service

        self.connection = provider.session.connection
        self.account = provider.identity.account
        self.thread_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    def _query(self, statement: str, params: tuple = ()) -> list[dict]:
        """Run a read-only statement and return rows as dictionaries.

        Args:
            statement: SQL to execute. Must be read-only (SHOW/SELECT/DESC).
            params: Bind parameters.

        Returns:
            List of rows keyed by lower-cased column name; an empty list when
            the role lacks privileges on the object, so checks degrade
            gracefully rather than aborting the scan.
        """
        cursor = None
        try:
            cursor = self.connection.cursor()
            cursor.execute(statement, params)
            columns = [column[0].lower() for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as error:
            message = str(error)
            if "does not exist or not authorized" in message or "Insufficient privileges" in message:
                logger.info(
                    f"{self.service} - Not authorized for statement; grant the scan "
                    f"role access to SNOWFLAKE.ACCOUNT_USAGE. ({message})"
                )
                return []
            if "Request rate limit" in message or "429" in message:
                raise SnowflakeRateLimitError(file=__file__, message=message)
            raise SnowflakeAPIError(
                file=__file__, original_exception=error, message=message
            )
        finally:
            if cursor is not None:
                cursor.close()

    def _show(self, what: str) -> list[dict]:
        """Run a SHOW command, returning an empty list when unauthorized."""
        return self._query(f"SHOW {what}")

    def _parameter(self, name: str, scope: str = "ACCOUNT") -> str:
        """Read a single account or object parameter value."""
        rows = self._query(f"SHOW PARAMETERS LIKE '{name}' IN {scope}")
        return rows[0].get("value", "") if rows else ""

    def __threading_call__(self, call, iterator):
        """Execute a function across multiple items using the shared thread pool."""
        items = list(iterator) if not isinstance(iterator, list) else iterator

        futures = {self.thread_pool.submit(call, item): item for item in items}
        results = []

        for future in as_completed(futures):
            try:
                result = future.result()
                if result is not None:
                    results.append(result)
            except Exception as error:
                item = futures[future]
                item_id = getattr(item, "name", str(item))
                logger.error(
                    f"{self.service} - Threading error processing {item_id}: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

        return results
`;

const account_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class Account(SnowflakeService):
    """Retrieve Snowflake account-level security parameters and integrations."""

    def __init__(self, provider):
        super().__init__("Account", provider)
        self.account_config: Optional[SnowflakeAccount] = None
        self._get_account()

    def _get_account(self):
        try:
            integrations = self._show("INTEGRATIONS")
            stages = self._query(
                """
                SELECT stage_name, stage_schema, stage_catalog, stage_type,
                       stage_url, storage_integration
                FROM SNOWFLAKE.ACCOUNT_USAGE.STAGES
                WHERE deleted IS NULL AND stage_type ILIKE 'External%'
                """
            )

            self.account_config = SnowflakeAccount(
                name=self.account,
                network_policy=self._parameter("NETWORK_POLICY"),
                periodic_data_rekeying=self._parameter(
                    "PERIODIC_DATA_REKEYING"
                ).lower()
                == "true",
                data_retention_time_in_days=int(
                    self._parameter("DATA_RETENTION_TIME_IN_DAYS") or 0
                ),
                min_data_retention_time_in_days=int(
                    self._parameter("MIN_DATA_RETENTION_TIME_IN_DAYS") or 0
                ),
                require_storage_integration_for_stage_creation=self._parameter(
                    "REQUIRE_STORAGE_INTEGRATION_FOR_STAGE_CREATION"
                ).lower()
                == "true",
                sso_integrations=[
                    integration.get("name", "")
                    for integration in integrations
                    if "SAML2" in (integration.get("type") or "").upper()
                    or "EXTERNAL_OAUTH" in (integration.get("type") or "").upper()
                ],
                scim_integrations=[
                    integration.get("name", "")
                    for integration in integrations
                    if "SCIM" in (integration.get("type") or "").upper()
                ],
                external_stages=[
                    SnowflakeExternalStage(
                        name=stage.get("stage_name", ""),
                        schema_name=stage.get("stage_schema", ""),
                        database_name=stage.get("stage_catalog", ""),
                        url=stage.get("stage_url") or "",
                        storage_integration=stage.get("storage_integration"),
                    )
                    for stage in stages
                ],
            )
            logger.info(f"Account - Read configuration for account {self.account}")
        except Exception as error:
            logger.error(
                f"Account - Error reading account configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SnowflakeExternalStage(BaseModel):
    """An external stage defined in the Snowflake account."""

    name: str
    schema_name: str = ""
    database_name: str = ""
    url: str = ""
    storage_integration: Optional[str] = None

    @property
    def qualified_name(self) -> str:
        return f"{self.database_name}.{self.schema_name}.{self.name}"


class SnowflakeAccount(BaseModel):
    """Snowflake account representation."""

    name: str
    network_policy: str = ""
    periodic_data_rekeying: bool = False
    data_retention_time_in_days: int = 0
    min_data_retention_time_in_days: int = 0
    require_storage_integration_for_stage_creation: bool = False
    sso_integrations: list[str] = Field(default_factory=list)
    scim_integrations: list[str] = Field(default_factory=list)
    external_stages: list[SnowflakeExternalStage] = Field(default_factory=list)
`;

const user_service = `from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class User(SnowflakeService):
    """Retrieve Snowflake users with authentication and role assignment detail."""

    def __init__(self, provider):
        super().__init__("User", provider)
        self.users: dict[str, SnowflakeUser] = {}
        self._list_users()

    def _list_users(self):
        try:
            rows = self._query(
                """
                SELECT name, login_name, disabled, has_password, has_rsa_public_key,
                       ext_authn_duo, default_role, last_success_login, created_on,
                       owner, type
                FROM SNOWFLAKE.ACCOUNT_USAGE.USERS
                WHERE deleted_on IS NULL
                """
            )
            if not rows:
                # Fall back to SHOW USERS when ACCOUNT_USAGE is not granted.
                rows = self._show("USERS")

            for raw in rows:
                user = SnowflakeUser(
                    name=raw.get("name", ""),
                    login_name=raw.get("login_name", ""),
                    user_type=(raw.get("type") or "PERSON").upper(),
                    disabled=_as_bool(raw.get("disabled")),
                    has_password=_as_bool(raw.get("has_password")),
                    has_rsa_public_key=_as_bool(raw.get("has_rsa_public_key")),
                    mfa_enrolled=_as_bool(raw.get("ext_authn_duo")),
                    default_role=raw.get("default_role") or "",
                    last_success_login=_as_datetime(raw.get("last_success_login")),
                    created_on=_as_datetime(raw.get("created_on")),
                    owner=raw.get("owner") or "",
                )
                self.users[user.name] = user
            logger.info(f"User - Found {len(self.users)} user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "yes", "y", "1")


def _as_datetime(value) -> Optional[datetime]:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class SnowflakeUser(BaseModel):
    """Snowflake user representation."""

    name: str
    login_name: str = ""
    user_type: str = "PERSON"
    disabled: bool = False
    has_password: bool = False
    has_rsa_public_key: bool = False
    mfa_enrolled: bool = False
    default_role: str = ""
    last_success_login: Optional[datetime] = None
    created_on: Optional[datetime] = None
    owner: str = ""
`;

const networkpolicy_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class NetworkPolicy(SnowflakeService):
    """Retrieve Snowflake network policies and their address lists."""

    def __init__(self, provider):
        super().__init__("NetworkPolicy", provider)
        self.policies: dict[str, SnowflakeNetworkPolicy] = {}
        self._list_policies()
        self.__threading_call__(self._describe_policy, list(self.policies.values()))

    def _list_policies(self):
        try:
            for raw in self._show("NETWORK POLICIES"):
                policy = SnowflakeNetworkPolicy(
                    name=raw.get("name", ""),
                    comment=raw.get("comment") or "",
                )
                self.policies[policy.name] = policy
            logger.info(f"NetworkPolicy - Found {len(self.policies)} network policy(ies)")
        except Exception as error:
            logger.error(
                f"NetworkPolicy - Error listing network policies: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _describe_policy(self, policy: "SnowflakeNetworkPolicy"):
        try:
            for row in self._query(f"DESC NETWORK POLICY {policy.name}"):
                name = (row.get("name") or "").upper()
                value = row.get("value") or ""
                entries = [item.strip() for item in value.split(",") if item.strip()]
                if name == "ALLOWED_IP_LIST":
                    policy.allowed_ip_list = entries
                elif name == "BLOCKED_IP_LIST":
                    policy.blocked_ip_list = entries
        except Exception as error:
            logger.error(
                f"NetworkPolicy - Error describing {policy.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SnowflakeNetworkPolicy(BaseModel):
    """Snowflake network policy representation."""

    name: str
    comment: str = ""
    allowed_ip_list: list[str] = Field(default_factory=list)
    blocked_ip_list: list[str] = Field(default_factory=list)
`;

export default {
  id: "snowflake",
  name: "Snowflake",
  pyClass: "Snowflake",
  baseUrl: "https://<account>.snowflakecomputing.com",
  selfHosted: true,
  samplePath: "SHOW PARAMETERS IN ACCOUNT",
  errorCodeBase: 14300,
  serviceBaseSource: service_base,
  credentialsRemediation:
    "Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER and either SNOWFLAKE_PRIVATE_KEY (recommended) or SNOWFLAKE_PASSWORD. The scan role needs IMPORTED PRIVILEGES on the SNOWFLAKE database to read ACCOUNT_USAGE.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Snowflake assesses a Snowflake account across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers multi-factor enrolment, key-pair authentication for service users, privileged default roles, network policy scoping, external stage integration and periodic rekeying — the controls that determine whether a stolen Snowflake credential yields the warehouse.",

  services: {
    account: { pyClass: "Account", source: account_service },
    user: { pyClass: "User", source: user_service },
    networkpolicy: { pyClass: "NetworkPolicy", source: networkpolicy_service },
  },

  checks: [
    {
      id: "snowflake_user_mfa_enrolled",
      service: "user",
      pillar: "iam",
      severity: "critical",
      title: "Snowflake human users are enrolled in multi-factor authentication",
      resourceType: "Snowflake::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that every enabled Snowflake user who can authenticate with a password is enrolled in **multi-factor authentication**. Service users authenticating by key pair are excluded, since they carry no password to phish.",
      risk:
        "Snowflake accounts hold consolidated analytical copies of an organisation's most sensitive data, and a password-only login is directly usable from anywhere on the internet. Large-scale intrusions into Snowflake tenants have been driven almost entirely by **credential reuse against accounts without MFA**, using passwords harvested from unrelated infostealer infections rather than any flaw in the platform.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/security-mfa",
        "https://docs.snowflake.com/en/user-guide/authentication-policies",
      ],
      relatedTo: ["snowflake_user_service_account_uses_key_pair_auth", "snowflake_account_sso_enabled"],
      remediation: {
        cli: "ALTER ACCOUNT SET MFA_ENROLLMENT = 'REQUIRED';\n-- Or enforce through an authentication policy:\nCREATE AUTHENTICATION POLICY require_mfa\n  MFA_ENROLLMENT = REQUIRED\n  CLIENT_TYPES = ('SNOWFLAKE_UI', 'DRIVERS');\nALTER ACCOUNT SET AUTHENTICATION POLICY require_mfa;",
        other:
          "1. Sign in to Snowsight as ACCOUNTADMIN\n2. Create an authentication policy with `MFA_ENROLLMENT = REQUIRED`\n3. Apply it at the account level, exempting only service users that authenticate by key pair\n4. Notify users, then enforce\n5. Review `SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY` for password logins that predate enforcement and treat those credentials as exposed",
        terraform:
          'resource "snowflake_authentication_policy" "require_mfa" {\n  database = "SECURITY"\n  schema   = "POLICIES"\n  name     = "REQUIRE_MFA"\n  mfa_enrollment = "REQUIRED"\n  client_types   = ["SNOWFLAKE_UI", "DRIVERS"]\n}',
        text:
          "Require MFA enrolment through an account-level authentication policy, and move every service user to key-pair authentication so the policy can be enforced without exempting automation.",
      },
      body: `findings = []
for user in user_client.users.values():
    if user.disabled:
        continue
    # Service users authenticate by key pair and hold no phishable password.
    if not user.has_password:
        continue

    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.name,
        resource_id=user.name,
    )

    if user.mfa_enrolled:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.name} is enrolled in multi-factor authentication."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.name} can authenticate with a password but is not "
            f"enrolled in multi-factor authentication."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "snowflake_user_service_account_uses_key_pair_auth",
      service: "user",
      pillar: "iam",
      severity: "high",
      title: "Snowflake service users authenticate with key pairs rather than passwords",
      resourceType: "Snowflake::User",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "Snowflake users of type `SERVICE` or `LEGACY_SERVICE` cannot complete an interactive MFA challenge, so a password on such an account is a **single-factor credential**. This check verifies that service users have an RSA public key registered and no password set.",
      risk:
        "A service user's password is typically embedded in an **ETL configuration, CI variable or notebook**, where it is copied, logged and shared far beyond its intended scope, and it cannot be protected by MFA. Because these accounts commonly hold broad warehouse privileges, one leaked configuration file grants durable, non-attributable access to the data platform.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/key-pair-auth",
        "https://docs.snowflake.com/en/user-guide/admin-user-management",
      ],
      relatedTo: ["snowflake_user_mfa_enrolled"],
      remediation: {
        cli: "ALTER USER svc_etl SET RSA_PUBLIC_KEY = 'MIIBIjANBgkq...';\nALTER USER svc_etl UNSET PASSWORD;\nALTER USER svc_etl SET TYPE = SERVICE;",
        other:
          "1. Generate an RSA key pair and store the private key in your secrets manager\n2. Register the public key with `ALTER USER <name> SET RSA_PUBLIC_KEY = '<key>'`\n3. Update the client configuration to authenticate with the private key\n4. Verify a successful key-pair login in `LOGIN_HISTORY`\n5. Remove the password with `ALTER USER <name> UNSET PASSWORD`\n6. Set `TYPE = SERVICE` so authentication policies can target these accounts distinctly\n7. Rotate the key pair on a schedule using `RSA_PUBLIC_KEY_2` for zero-downtime rollover",
        terraform:
          'resource "snowflake_service_user" "etl" {\n  name            = "SVC_ETL"\n  rsa_public_key  = var.etl_public_key\n  default_role    = snowflake_role.etl.name\n  default_warehouse = snowflake_warehouse.etl.name\n}',
        text:
          "Move every service user to key-pair authentication, remove its password, and rotate keys using the secondary key slot so rollover needs no downtime.",
      },
      body: `findings = []
for user in user_client.users.values():
    if user.disabled:
        continue
    if user.user_type not in ("SERVICE", "LEGACY_SERVICE"):
        continue

    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.name,
        resource_id=user.name,
    )

    if user.has_rsa_public_key and not user.has_password:
        report.status = "PASS"
        report.status_extended = (
            f"Service user {user.name} authenticates with a key pair and has no "
            f"password set."
        )
    elif user.has_rsa_public_key:
        report.status = "FAIL"
        report.status_extended = (
            f"Service user {user.name} has a key pair registered but still has a "
            f"password set."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Service user {user.name} authenticates with a password and has no "
            f"key pair registered."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "snowflake_user_default_role_not_privileged",
      service: "user",
      pillar: "iam",
      severity: "high",
      title: "Snowflake users do not default to ACCOUNTADMIN or SECURITYADMIN",
      resourceType: "Snowflake::User",
      resourceGroup: "iam",
      categories: ["authentication", "trust-boundaries"],
      description:
        "A user's **default role** is assumed automatically on connection. This check reports enabled users whose default role is `ACCOUNTADMIN`, `SECURITYADMIN` or `ORGADMIN`, so privileged roles must be selected deliberately rather than inherited by every session.",
      risk:
        "When a session starts as ACCOUNTADMIN, every routine query, notebook and BI connection runs with **full account privileges**, and any SQL injection or compromised client immediately inherits them. Snowflake's own guidance is that ACCOUNTADMIN should be assumed explicitly for administrative work only, so a privileged default role removes the last barrier between an ordinary mistake and account-wide impact.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/security-access-control-considerations",
        "https://docs.snowflake.com/en/sql-reference/sql/alter-user",
      ],
      remediation: {
        cli: "ALTER USER analyst SET DEFAULT_ROLE = ANALYST_RO;\n-- Confirm who holds ACCOUNTADMIN:\nSHOW GRANTS OF ROLE ACCOUNTADMIN;",
        other:
          "1. List users whose default role is privileged\n2. Create or identify a least-privilege functional role for each user's day-to-day work\n3. Set it with `ALTER USER <name> SET DEFAULT_ROLE = <functional_role>`\n4. Keep ACCOUNTADMIN granted to a small named set of administrators who assume it explicitly with `USE ROLE`\n5. Ensure every ACCOUNTADMIN holder is MFA-enrolled\n6. Alert on ACCOUNTADMIN usage in `QUERY_HISTORY`",
        terraform:
          'resource "snowflake_user" "analyst" {\n  name         = "ANALYST"\n  default_role = snowflake_role.analyst_ro.name\n  default_warehouse = snowflake_warehouse.bi.name\n}',
        text:
          "Give every user a least-privilege functional default role, reserve ACCOUNTADMIN for explicit assumption by a small named group, and alert on its use.",
      },
      body: `PRIVILEGED_ROLES = {"ACCOUNTADMIN", "SECURITYADMIN", "ORGADMIN"}

findings = []
for user in user_client.users.values():
    if user.disabled:
        continue

    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.name,
        resource_id=user.name,
    )

    default_role = (user.default_role or "").upper()

    if default_role in PRIVILEGED_ROLES:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.name} has the privileged default role {default_role}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.name} has the default role "
            f"{default_role or '(none)'}, which is not privileged."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "snowflake_user_no_stale_accounts",
      service: "user",
      pillar: "iam",
      severity: "medium",
      title: "Snowflake has no enabled users that are dormant or never used",
      resourceType: "Snowflake::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check reports enabled Snowflake users that have never logged in, or whose last successful login predates the configured dormancy threshold (90 days by default).",
      risk:
        "A dormant but enabled account is a **credential nobody is watching**: its password is rarely rotated, its owner may have left, and unusual activity on it raises no expectation of being noticed. Because Snowflake roles are typically granted at onboarding and rarely revisited, stale accounts often retain access to data the person or system no longer has any business reason to read.",
      urls: [
        "https://docs.snowflake.com/en/sql-reference/account-usage/users",
        "https://docs.snowflake.com/en/user-guide/admin-user-management",
      ],
      remediation: {
        cli: "SELECT name, last_success_login FROM SNOWFLAKE.ACCOUNT_USAGE.USERS\n  WHERE deleted_on IS NULL AND NOT disabled\n    AND (last_success_login IS NULL OR last_success_login < DATEADD(day, -90, CURRENT_TIMESTAMP()));\nALTER USER <name> SET DISABLED = TRUE;",
        other:
          "1. Run the dormancy query against `SNOWFLAKE.ACCOUNT_USAGE.USERS`\n2. Confirm with the owning team whether each account is still needed\n3. Disable rather than drop first, so any dependency surfaces safely\n4. Drop accounts that remain unclaimed after the grace period\n5. Connect Snowflake to your identity provider with SCIM so deprovisioning becomes automatic\n6. Schedule the review as a recurring task",
        terraform: "",
        text:
          "Disable then remove dormant accounts, and connect Snowflake to your IdP with SCIM so joiner-mover-leaver events deprovision users automatically instead of relying on periodic review.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_idle_days = self.audit_config.get("max_user_idle_days", 90)
cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)

findings = []
for user in user_client.users.values():
    if user.disabled:
        continue

    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.name,
        resource_id=user.name,
    )

    last_login = user.last_success_login
    if last_login is not None and last_login.tzinfo is None:
        last_login = last_login.replace(tzinfo=timezone.utc)

    if last_login is None:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.name} is enabled but has never logged in."
        )
    elif last_login < cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.name} is enabled but has not logged in since "
            f"{last_login.date()} (threshold {max_idle_days} days)."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.name} last logged in on {last_login.date()}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "snowflake_account_network_policy_enforced",
      service: "account",
      pillar: "attacksurface",
      severity: "high",
      title: "Snowflake accounts enforce an account-level network policy",
      resourceType: "Snowflake::Account",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "An account-level **network policy** limits which IP addresses may connect to the Snowflake account. This check verifies that the `NETWORK_POLICY` account parameter is set rather than left empty.",
      risk:
        "Without a network policy the account accepts authentication attempts from **any address on the internet**, so a credential harvested elsewhere is immediately usable with no further foothold required. Network scoping is the control that most reliably breaks that path, because it invalidates a stolen password even before authentication policy is considered.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/network-policies",
        "https://docs.snowflake.com/en/user-guide/security-network-overview",
      ],
      relatedTo: ["snowflake_networkpolicy_no_broad_allowlist"],
      remediation: {
        cli: "CREATE NETWORK POLICY corporate_access\n  ALLOWED_IP_LIST = ('203.0.113.0/24', '198.51.100.0/24');\nALTER ACCOUNT SET NETWORK_POLICY = corporate_access;",
        other:
          "1. Collect the egress CIDR ranges of your offices, VPN, BI tools and ETL infrastructure\n2. Create a network policy with those ranges in `ALLOWED_IP_LIST`\n3. Verify your own address is included before applying, or you will lock yourself out\n4. Apply it with `ALTER ACCOUNT SET NETWORK_POLICY = <name>`\n5. For cloud-hosted clients, prefer private connectivity (PrivateLink) with a policy restricted to the private endpoint\n6. Review `LOGIN_HISTORY` for connections from outside the intended ranges before enforcing",
        terraform:
          'resource "snowflake_network_policy" "corporate" {\n  name            = "CORPORATE_ACCESS"\n  allowed_ip_list = ["203.0.113.0/24", "198.51.100.0/24"]\n}\n\nresource "snowflake_account_parameter" "network_policy" {\n  key   = "NETWORK_POLICY"\n  value = snowflake_network_policy.corporate.name\n}',
        text:
          "Attach a network policy at the account level covering only your corporate, VPN and data-pipeline egress ranges, and prefer PrivateLink for cloud-hosted clients.",
      },
      body: `findings = []
account = account_client.account_config
if account is None:
    return findings

report = CheckReportSnowflake(
    metadata=self.metadata(),
    resource=account,
    resource_name=account.name,
    resource_id=account.name,
)

if account.network_policy:
    report.status = "PASS"
    report.status_extended = (
        f"Account {account.name} enforces the network policy "
        f"{account.network_policy}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Account {account.name} does not enforce an account-level network policy."
    )

findings.append(report)
return findings`,
    },

    {
      id: "snowflake_account_sso_enabled",
      service: "account",
      pillar: "iam",
      severity: "high",
      title: "Snowflake accounts federate authentication through SSO",
      resourceType: "Snowflake::Account::Integration",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the account has a **SAML2 or External OAuth security integration** configured, so human access is governed by the corporate identity provider rather than by Snowflake-local passwords.",
      risk:
        "Snowflake-local passwords sit outside the controls your identity provider applies — **no conditional access, no device posture, no central session revocation**, and no automatic disablement when someone leaves. During an incident, the inability to revoke access centrally materially extends the time an attacker keeps a working credential.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/admin-security-fed-auth-overview",
        "https://docs.snowflake.com/en/user-guide/oauth-ext-overview",
      ],
      relatedTo: ["snowflake_user_mfa_enrolled"],
      remediation: {
        cli: "CREATE SECURITY INTEGRATION corporate_sso\n  TYPE = SAML2\n  ENABLED = TRUE\n  SAML2_ISSUER = 'https://idp.example.com'\n  SAML2_SSO_URL = 'https://idp.example.com/sso/saml'\n  SAML2_PROVIDER = 'CUSTOM'\n  SAML2_X509_CERT = '<certificate>';",
        other:
          "1. Register Snowflake as an application in your identity provider\n2. Create a SAML2 (or External OAuth) security integration in Snowflake\n3. Test federated login with a pilot user before broad rollout\n4. Add a SCIM integration so user and role provisioning follows the IdP\n5. Once federation is proven, remove Snowflake-local passwords from human users\n6. Retain one break-glass local administrator with a stored, monitored credential",
        terraform:
          'resource "snowflake_saml_integration" "corporate_sso" {\n  name           = "CORPORATE_SSO"\n  enabled        = true\n  saml2_issuer   = "https://idp.example.com"\n  saml2_sso_url  = "https://idp.example.com/sso/saml"\n  saml2_provider = "CUSTOM"\n  saml2_x509_cert = var.idp_certificate\n}',
        text:
          "Federate human authentication through SAML2 or External OAuth, add SCIM for provisioning, then remove local passwords — keeping one monitored break-glass administrator.",
      },
      body: `findings = []
account = account_client.account_config
if account is None:
    return findings

report = CheckReportSnowflake(
    metadata=self.metadata(),
    resource=account,
    resource_name=account.name,
    resource_id=account.name,
)

if account.sso_integrations:
    report.status = "PASS"
    report.status_extended = (
        f"Account {account.name} federates authentication through "
        f"{', '.join(account.sso_integrations)}."
    )
    if not account.scim_integrations:
        report.status_extended += " No SCIM integration is configured for provisioning."
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Account {account.name} has no SAML2 or External OAuth security "
        f"integration configured."
    )

findings.append(report)
return findings`,
    },

    {
      id: "snowflake_account_periodic_rekeying_enabled",
      service: "account",
      pillar: "encryption",
      severity: "medium",
      title: "Snowflake accounts enable periodic data rekeying",
      resourceType: "Snowflake::Account",
      resourceGroup: "storage",
      categories: ["encryption"],
      description:
        "With `PERIODIC_DATA_REKEYING` enabled, Snowflake re-encrypts data whose encryption key is older than one year with a fresh key. This check verifies that the account parameter is set to true.",
      risk:
        "Without rekeying, the same data encryption key protects a table for its entire lifetime, so the **window in which a single compromised key is useful is unbounded**. Periodic rekeying limits the blast radius of key compromise and satisfies the cryptoperiod expectations that appear in most data protection standards.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/security-encryption-manage",
        "https://docs.snowflake.com/en/user-guide/security-encryption-end-to-end",
      ],
      remediation: {
        cli: "ALTER ACCOUNT SET PERIODIC_DATA_REKEYING = TRUE;",
        other:
          "1. Sign in to Snowsight as ACCOUNTADMIN\n2. Run `ALTER ACCOUNT SET PERIODIC_DATA_REKEYING = TRUE`\n3. Note that rekeying consumes credits as it re-encrypts historical data; plan for the one-off cost\n4. For stricter key control, additionally enable Tri-Secret Secure so a customer-managed key in your cloud KMS is required alongside Snowflake's key\n5. Confirm the parameter with `SHOW PARAMETERS LIKE 'PERIODIC_DATA_REKEYING' IN ACCOUNT`",
        terraform:
          'resource "snowflake_account_parameter" "rekeying" {\n  key   = "PERIODIC_DATA_REKEYING"\n  value = "true"\n}',
        text:
          "Enable periodic data rekeying so encryption keys are rotated annually, and consider Tri-Secret Secure where you need the ability to revoke access with a customer-managed key.",
      },
      body: `findings = []
account = account_client.account_config
if account is None:
    return findings

report = CheckReportSnowflake(
    metadata=self.metadata(),
    resource=account,
    resource_name=account.name,
    resource_id=account.name,
)

if account.periodic_data_rekeying:
    report.status = "PASS"
    report.status_extended = (
        f"Account {account.name} has periodic data rekeying enabled."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Account {account.name} does not have periodic data rekeying enabled."
    )

findings.append(report)
return findings`,
    },

    {
      id: "snowflake_account_external_stage_uses_storage_integration",
      service: "account",
      pillar: "encryption",
      severity: "high",
      title: "Snowflake external stages use a storage integration rather than embedded credentials",
      resourceType: "Snowflake::Stage",
      resourceGroup: "storage",
      categories: ["secrets", "trust-boundaries"],
      description:
        "A **storage integration** lets Snowflake reach cloud object storage through a managed IAM trust relationship instead of credentials written into the stage definition. This check reports external stages with no storage integration attached.",
      risk:
        "An external stage created with inline credentials stores a **long-lived cloud access key inside the stage definition**, where it is visible to anyone who can run `DESC STAGE` and is copied into every clone, backup and DDL export. Those keys are typically over-permissioned on the bucket, so a Snowflake reader-level compromise escalates into direct access to the underlying data lake.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration",
        "https://docs.snowflake.com/en/sql-reference/sql/create-storage-integration",
      ],
      remediation: {
        cli: "CREATE STORAGE INTEGRATION s3_data_lake\n  TYPE = EXTERNAL_STAGE\n  STORAGE_PROVIDER = 'S3'\n  STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/snowflake-stage'\n  ENABLED = TRUE\n  STORAGE_ALLOWED_LOCATIONS = ('s3://data-lake/curated/');\nALTER STAGE curated_stage SET STORAGE_INTEGRATION = s3_data_lake;",
        other:
          "1. Create a cloud IAM role trusted by your Snowflake account\n2. Create a storage integration referencing that role, with `STORAGE_ALLOWED_LOCATIONS` scoped to the specific prefix\n3. Recreate or alter each external stage to use the integration\n4. Remove the inline `CREDENTIALS = (...)` clause\n5. Revoke the cloud access key that was embedded in the stage — treat it as compromised\n6. Set `REQUIRE_STORAGE_INTEGRATION_FOR_STAGE_CREATION = TRUE` so new stages cannot reintroduce inline credentials",
        terraform:
          'resource "snowflake_storage_integration" "data_lake" {\n  name                      = "S3_DATA_LAKE"\n  type                      = "EXTERNAL_STAGE"\n  storage_provider          = "S3"\n  storage_aws_role_arn      = aws_iam_role.snowflake_stage.arn\n  storage_allowed_locations = ["s3://data-lake/curated/"]\n  enabled                   = true\n}',
        text:
          "Point every external stage at a storage integration scoped to the narrowest possible prefix, revoke any embedded access key, and set REQUIRE_STORAGE_INTEGRATION_FOR_STAGE_CREATION so the pattern cannot recur.",
      },
      body: `findings = []
account = account_client.account_config
if account is None:
    return findings

for stage in account.external_stages:
    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=stage,
        resource_name=stage.qualified_name,
        resource_id=stage.qualified_name,
    )

    if stage.storage_integration:
        report.status = "PASS"
        report.status_extended = (
            f"External stage {stage.qualified_name} uses storage integration "
            f"{stage.storage_integration}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"External stage {stage.qualified_name} ({stage.url}) does not use a "
            f"storage integration and may hold embedded credentials."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "snowflake_account_data_retention_time_configured",
      service: "account",
      pillar: "logging",
      severity: "medium",
      title: "Snowflake accounts configure a minimum Time Travel retention period",
      resourceType: "Snowflake::Account",
      resourceGroup: "storage",
      categories: ["logging", "resilience"],
      description:
        "**Time Travel** retention determines how far back a table's prior state can be queried or restored. This check verifies that the account sets a retention period of at least one day, and reports where the minimum is left at zero.",
      risk:
        "With retention at zero, a destructive statement — a mistaken `TRUNCATE`, or deliberate tampering by an attacker covering their tracks — is **immediately unrecoverable**, and there is no prior version to compare against when determining what was changed. Time Travel is often the only mechanism that can establish what a table contained before an incident.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/data-time-travel",
        "https://docs.snowflake.com/en/user-guide/data-failsafe",
      ],
      remediation: {
        cli: "ALTER ACCOUNT SET DATA_RETENTION_TIME_IN_DAYS = 7;\nALTER ACCOUNT SET MIN_DATA_RETENTION_TIME_IN_DAYS = 1;",
        other:
          "1. Sign in to Snowsight as ACCOUNTADMIN\n2. Set `DATA_RETENTION_TIME_IN_DAYS` to your recovery objective (1 on Standard, up to 90 on Enterprise)\n3. Set `MIN_DATA_RETENTION_TIME_IN_DAYS` so an object owner cannot lower retention below the floor\n4. Increase retention specifically on databases holding regulated or business-critical data\n5. Account for the storage cost of retained versions when choosing the window",
        terraform:
          'resource "snowflake_account_parameter" "retention" {\n  key   = "DATA_RETENTION_TIME_IN_DAYS"\n  value = "7"\n}\n\nresource "snowflake_account_parameter" "min_retention" {\n  key   = "MIN_DATA_RETENTION_TIME_IN_DAYS"\n  value = "1"\n}',
        text:
          "Set a Time Travel retention window that matches your recovery objective and enforce a floor with MIN_DATA_RETENTION_TIME_IN_DAYS so object owners cannot reduce it below policy.",
      },
      body: `findings = []
account = account_client.account_config
if account is None:
    return findings

report = CheckReportSnowflake(
    metadata=self.metadata(),
    resource=account,
    resource_name=account.name,
    resource_id=account.name,
)

retention = account.data_retention_time_in_days
minimum = account.min_data_retention_time_in_days

if retention >= 1 and minimum >= 1:
    report.status = "PASS"
    report.status_extended = (
        f"Account {account.name} retains Time Travel data for {retention} day(s) "
        f"with a floor of {minimum} day(s)."
    )
elif retention >= 1:
    report.status = "FAIL"
    report.status_extended = (
        f"Account {account.name} retains Time Travel data for {retention} day(s) "
        f"but sets no minimum, so object owners can reduce it to zero."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Account {account.name} has Time Travel retention set to {retention} days."
    )

findings.append(report)
return findings`,
    },

    {
      id: "snowflake_networkpolicy_no_broad_allowlist",
      service: "networkpolicy",
      pillar: "attacksurface",
      severity: "high",
      title: "Snowflake network policies do not allow the entire internet",
      resourceType: "Snowflake::NetworkPolicy",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "This check inspects each network policy's `ALLOWED_IP_LIST` for entries that permit the whole address space (`0.0.0.0/0`, `::/0`) or an excessively wide range, which would make the policy ineffective.",
      risk:
        "A network policy containing `0.0.0.0/0` **satisfies configuration checks while enforcing nothing**, which is worse than having no policy at all because it creates the appearance of a control. These entries are usually added temporarily to unblock a client and then never removed, leaving the account open to authentication attempts from anywhere.",
      urls: [
        "https://docs.snowflake.com/en/user-guide/network-policies",
        "https://docs.snowflake.com/en/sql-reference/sql/create-network-policy",
      ],
      relatedTo: ["snowflake_account_network_policy_enforced"],
      remediation: {
        cli: "ALTER NETWORK POLICY corporate_access SET\n  ALLOWED_IP_LIST = ('203.0.113.0/24', '198.51.100.0/24');\nDESC NETWORK POLICY corporate_access;",
        other:
          "1. Run `DESC NETWORK POLICY <name>` and review the allowed list\n2. Replace `0.0.0.0/0` and other wide ranges with the specific CIDRs your clients use\n3. Where a partner or SaaS tool needs access, use its documented static egress ranges rather than opening the policy\n4. For cloud-hosted clients, move to PrivateLink and restrict the policy to the private endpoint\n5. Re-test connectivity from each client after narrowing",
        terraform:
          'resource "snowflake_network_policy" "corporate" {\n  name            = "CORPORATE_ACCESS"\n  allowed_ip_list = ["203.0.113.0/24", "198.51.100.0/24"]\n  blocked_ip_list = []\n}',
        text:
          "Remove open ranges from the allowed IP list and replace them with the specific egress CIDRs of each client, preferring PrivateLink for workloads running in cloud accounts.",
      },
      body: `import ipaddress

# A /8 or wider is treated as an over-broad grant for an allowlist.
MAX_PREFIX_HOSTS = 2**24

findings = []
for policy in networkpolicy_client.policies.values():
    report = CheckReportSnowflake(
        metadata=self.metadata(),
        resource=policy,
        resource_name=policy.name,
        resource_id=policy.name,
    )

    if not policy.allowed_ip_list:
        report.status = "PASS"
        report.status_extended = (
            f"Network policy {policy.name} defines no allowed IP list; access is "
            f"governed by its blocked list."
        )
        findings.append(report)
        continue

    broad = []
    for entry in policy.allowed_ip_list:
        try:
            network = ipaddress.ip_network(entry, strict=False)
        except ValueError:
            continue
        if network.num_addresses >= MAX_PREFIX_HOSTS:
            broad.append(entry)

    if broad:
        report.status = "FAIL"
        report.status_extended = (
            f"Network policy {policy.name} allows over-broad range(s): "
            f"{', '.join(broad)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Network policy {policy.name} allows {len(policy.allowed_ip_list)} "
            f"scoped range(s)."
        )

    findings.append(report)

return findings`,
    },
  ],
};
