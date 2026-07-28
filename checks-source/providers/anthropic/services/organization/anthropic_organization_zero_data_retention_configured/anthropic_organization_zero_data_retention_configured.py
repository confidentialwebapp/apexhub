from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.organization.organization_client import organization_client


class anthropic_organization_zero_data_retention_configured(Check):
    """Anthropic organizations configure zero data retention where eligible

    Prompts routinely carry source code, customer records and internal documents that were never assessed for third-party storage, and retained copies fall outside your own deletion and residency commitments. Zero data retention narrows the window in which that content exists anywhere outside your environment to the duration of the request itself.
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

        if organization.zero_data_retention:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has zero data "
                f"retention configured."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not have zero "
                f"data retention configured."
            )

        findings.append(report)
        return findings
