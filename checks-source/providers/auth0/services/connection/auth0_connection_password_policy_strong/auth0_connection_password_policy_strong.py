from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.connection.connection_client import connection_client


class auth0_connection_password_policy_strong(Check):
    """Auth0 database connections enforce a strong password policy

    A database connection is where Auth0 stores the credentials it authenticates against, so a weak policy there directly determines how guessable your users' passwords are. Combined with the login endpoint being publicly reachable by design, a low minimum length makes credential stuffing and password spraying practical against the identity provider that fronts every application.
    """

    def execute(self) -> List[CheckReportAuth0]:
        STRONG_POLICIES = {"good", "excellent"}
        DATABASE_STRATEGIES = {"auth0"}

        min_length_required = self.audit_config.get("min_password_length", 12)

        findings = []
        for connection in connection_client.connections.values():
            if connection.strategy not in DATABASE_STRATEGIES:
                continue

            report = CheckReportAuth0(
                metadata=self.metadata(),
                resource=connection,
                resource_name=connection.name,
                resource_id=connection.id,
            )

            issues = []
            policy = (connection.password_policy or "none").lower()
            if policy not in STRONG_POLICIES:
                issues.append(f"password policy is '{policy}'")
            if (connection.min_password_length or 0) < min_length_required:
                issues.append(
                    f"minimum length is {connection.min_password_length or 'unset'} "
                    f"(expected {min_length_required})"
                )
            if not connection.brute_force_protection:
                issues.append("brute force protection is disabled")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Connection {connection.name}: {'; '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Connection {connection.name} enforces the '{policy}' password policy "
                    f"with a minimum length of {connection.min_password_length} and brute "
                    f"force protection enabled."
                )

            findings.append(report)

        return findings
