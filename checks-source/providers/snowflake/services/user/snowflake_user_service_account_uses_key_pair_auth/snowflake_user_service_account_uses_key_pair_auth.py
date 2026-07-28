from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.user.user_client import user_client


class snowflake_user_service_account_uses_key_pair_auth(Check):
    """Snowflake service users authenticate with key pairs rather than passwords

    A service user's password is typically embedded in an ETL configuration, CI variable or notebook, where it is copied, logged and shared far beyond its intended scope, and it cannot be protected by MFA. Because these accounts commonly hold broad warehouse privileges, one leaked configuration file grants durable, non-attributable access to the data platform.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        findings = []
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

        return findings
