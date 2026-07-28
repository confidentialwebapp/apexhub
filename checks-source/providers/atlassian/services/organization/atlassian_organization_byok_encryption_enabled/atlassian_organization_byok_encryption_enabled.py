from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.organization.organization_client import organization_client


class atlassian_organization_byok_encryption_enabled(Check):
    """Atlassian organizations use bring-your-own-key encryption

    With provider-managed keys only, you have no independent means of revoking access to your Jira and Confluence data during a suspected platform compromise — containment depends entirely on the provider. An unset residency region additionally means data may be stored outside the jurisdiction your regulatory commitments assume.
    """

    def execute(self) -> List[CheckReportAtlassian]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportAtlassian(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        if organization.byok_enabled:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} encrypts product "
                f"data with a customer-managed key."
            )
            if not organization.data_residency_region:
                report.status_extended += " No data residency region is pinned."
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not use "
                f"bring-your-own-key encryption"
                f"{' and has no data residency region pinned' if not organization.data_residency_region else ''}."
            )

        findings.append(report)
        return findings
