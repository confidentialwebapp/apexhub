from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.tenant.tenant_client import tenant_client


class auth0_tenant_log_streaming_configured(Check):
    """Auth0 tenants stream logs to an external system

    Auth0 log retention is measured in days on most plans, so by the time an account compromise is detected the authentication events that would explain it have often already aged out. Streamed logs are also the only source that shows failed login patterns, MFA enrolment changes and token exchanges — the primary indicators of an identity attack in progress.
    """

    def execute(self) -> List[CheckReportAuth0]:
        findings = []
        tenant = tenant_client.tenant
        if tenant is None:
            return findings

        report = CheckReportAuth0(
            metadata=self.metadata(),
            resource=tenant,
            resource_name=tenant.name,
            resource_id=tenant.domain,
        )

        active = [
            stream for stream in tenant.log_streams if stream.status.lower() == "active"
        ]

        if active:
            report.status = "PASS"
            report.status_extended = (
                f"Tenant {tenant.name} has {len(active)} active log stream(s): "
                f"{', '.join(stream.name or stream.type for stream in active)}."
            )
        elif tenant.log_streams:
            report.status = "FAIL"
            report.status_extended = (
                f"Tenant {tenant.name} has {len(tenant.log_streams)} log stream(s) "
                f"configured but none are active."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Tenant {tenant.name} has no log stream configured."
            )

        findings.append(report)
        return findings
