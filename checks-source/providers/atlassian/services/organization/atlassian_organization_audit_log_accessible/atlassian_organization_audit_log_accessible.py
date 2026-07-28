from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.organization.organization_client import organization_client


class atlassian_organization_audit_log_accessible(Check):
    """Atlassian organizations have an accessible audit log

    Without exported organization events there is no durable record of policy changes, product access grants, API token creation or account claims. Those are the actions an attacker takes to establish persistence in Atlassian Cloud, and the in-product view is both time-limited and visible only to the same administrators whose actions it records.
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

        if organization.audit_log_readable:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has a readable audit "
                f"log available for export."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} audit log is not "
                f"readable; administrative events cannot be exported."
            )

        findings.append(report)
        return findings
