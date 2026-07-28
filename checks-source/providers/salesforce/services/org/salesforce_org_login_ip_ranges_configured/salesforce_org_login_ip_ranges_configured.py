from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.org.org_client import org_client


class salesforce_org_login_ip_ranges_configured(Check):
    """Salesforce orgs restrict login to trusted IP ranges

    Without login IP ranges, a phished credential is usable immediately from the attacker's own infrastructure, and the identity verification challenge that would otherwise fire for an unrecognised address can be satisfied by the same phishing proxy that captured the password. Network scoping breaks that chain at a layer the phishing kit cannot relay.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        import ipaddress

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

        if not org.login_ip_ranges:
            report.status = "FAIL"
            report.status_extended = (
                f"Org {org.name} defines no trusted login IP ranges."
            )
            findings.append(report)
            return findings

        # A range covering more than a /16 offers little practical restriction.
        max_range_size = 65536
        broad = []
        for entry in org.login_ip_ranges:
            try:
                start = int(ipaddress.ip_address(entry.start_address))
                end = int(ipaddress.ip_address(entry.end_address))
            except ValueError:
                continue
            if end - start + 1 > max_range_size:
                broad.append(f"{entry.start_address}-{entry.end_address}")

        if broad:
            report.status = "FAIL"
            report.status_extended = (
                f"Org {org.name} defines trusted login IP range(s) that are over-broad: "
                f"{', '.join(broad)}."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Org {org.name} restricts login to {len(org.login_ip_ranges)} scoped IP "
                f"range(s)."
            )

        findings.append(report)
        return findings
