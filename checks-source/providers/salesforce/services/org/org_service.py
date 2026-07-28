from typing import Optional

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
