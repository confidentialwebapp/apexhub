from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.account.account_client import account_client


class snowflake_account_sso_enabled(Check):
    """Snowflake accounts federate authentication through SSO

    Snowflake-local passwords sit outside the controls your identity provider applies — no conditional access, no device posture, no central session revocation, and no automatic disablement when someone leaves. During an incident, the inability to revoke access centrally materially extends the time an attacker keeps a working credential.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        findings = []
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
        return findings
