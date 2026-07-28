from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.organization.organization_client import organization_client


class terraformcloud_organization_sso_enforced(Check):
    """HCP Terraform organizations enforce SSO for collaborators

    HCP Terraform holds the credentials that provision your entire cloud estate, so an account there is effectively an administrative account for the infrastructure it manages. Without enforced SSO there is no conditional access and no central revocation, and a departed engineer's account keeps its apply permissions until someone remembers to remove it.
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

            policy = (organization.collaborator_auth_policy or "password").lower()

            if organization.sso_enabled and policy == "sso":
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {organization.name} requires SSO for collaborators."
                )
            elif organization.sso_enabled:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} has SSO configured but its "
                    f"collaborator authentication policy is '{policy}'."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} does not have SSO configured."
                )

            findings.append(report)

        return findings
