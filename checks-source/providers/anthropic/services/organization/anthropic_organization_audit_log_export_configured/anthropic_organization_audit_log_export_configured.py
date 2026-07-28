from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.organization.organization_client import organization_client


class anthropic_organization_audit_log_export_configured(Check):
    """Anthropic organizations export audit logs to an external system

    API key creation is the event that matters most in this platform, and without an external export there is no durable, independently held record of who created which key. An attacker who reaches admin can mint a key and, with no exported trail, the organization cannot later establish when the access was granted or which keys to consider compromised.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportAnthropic(
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
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not export "
                f"audit logs to an external system."
            )

        findings.append(report)
        return findings
