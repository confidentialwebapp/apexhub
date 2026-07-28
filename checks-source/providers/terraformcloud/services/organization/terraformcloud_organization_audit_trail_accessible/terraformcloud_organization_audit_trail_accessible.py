from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.organization.organization_client import organization_client


class terraformcloud_organization_audit_trail_accessible(Check):
    """HCP Terraform organizations have an accessible audit trail

    The Terraform audit trail is the record of who changed the infrastructure and what credentials were touched, and it is retained for a limited period. Without an export, a compromise of the Terraform organization cannot be reconstructed: you cannot establish which state files were read, which variables were altered, or when the attacker's team token was created.
    """

    def execute(self) -> List[CheckReportTerraformCloud]:
        findings = []
        for organization in organization_client.organizations.values():
            report = CheckReportTerraformCloud(
                metadata=self.metadata(),
                resource=organization,
                resource_name=organization.name,
                resource_id=organization.name,
            )

            if organization.audit_trail_readable:
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {organization.name} has a readable audit trail "
                    f"available for export."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} audit trail is not readable; "
                    f"infrastructure change events cannot be exported."
                )

            findings.append(report)

        return findings
