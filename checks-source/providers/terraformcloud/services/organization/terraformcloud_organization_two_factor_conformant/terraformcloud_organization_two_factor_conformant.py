from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.organization.organization_client import organization_client


class terraformcloud_organization_two_factor_conformant(Check):
    """HCP Terraform organization members are two-factor conformant

    A single member without two-factor authentication is enough to compromise the organization, because Terraform permissions are typically broad by necessity — the tooling must be able to create and destroy the resources it manages. An attacker holding one such account can read state containing production credentials and queue applies against live infrastructure.
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

            if organization.two_factor_conformant:
                report.status = "PASS"
                report.status_extended = (
                    f"All members of organization {organization.name} have two-factor "
                    f"authentication enabled."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} has member(s) without two-factor "
                    f"authentication enabled."
                )

            findings.append(report)

        return findings
