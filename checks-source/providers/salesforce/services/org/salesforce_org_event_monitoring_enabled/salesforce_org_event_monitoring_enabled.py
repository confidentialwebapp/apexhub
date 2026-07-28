from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.org.org_client import org_client


class salesforce_org_event_monitoring_enabled(Check):
    """Salesforce orgs have Event Monitoring enabled

    Without Event Monitoring there is no record of data export: the setup audit trail captures configuration changes but not who ran which report or pulled which records through the API. That is precisely the evidence needed to scope a data breach, and its absence turns an investigation into guesswork about what an attacker actually took.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        findings = []
        org = org_client.org
        if org is None:
            return findings

        report = CheckReportSalesforce(
            metadata=self.metadata(),
            resource=org,
            resource_name=org.name,
            resource_id=org.id,
        )

        if org.event_monitoring_enabled:
            report.status = "PASS"
            report.status_extended = f"Org {org.name} has Event Monitoring available."
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Org {org.name} does not have Event Monitoring available; data export "
                f"and API activity are not recorded."
            )

        findings.append(report)
        return findings
