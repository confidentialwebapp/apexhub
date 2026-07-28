from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.org.org_client import org_client


class salesforce_org_shield_platform_encryption_configured(Check):
    """Salesforce orgs encrypt sensitive fields with Shield Platform Encryption

    Salesforce's default at-rest encryption is transparent to the platform, so it offers no protection against an authenticated attacker or an over-permissioned integration reading the data. Shield encryption additionally gives you a tenant secret you control, which is what makes crypto-shredding — destroying the key to render data unrecoverable — possible at all.
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

        if org.encrypted_fields:
            report.status = "PASS"
            report.status_extended = (
                f"Org {org.name} encrypts {len(org.encrypted_fields)} field(s) with Shield "
                f"Platform Encryption."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Org {org.name} has no fields encrypted with Shield Platform Encryption."
            )

        findings.append(report)
        return findings
