from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.organization.organization_client import organization_client


class anthropic_organization_sso_enforced(Check):
    """Anthropic organizations enforce SSO with a verified domain

    Console access is what creates and reads API keys, so a member signing in with a personal credential holds an unmanaged path to your model capacity. Without federation there is no conditional access, no central session revocation and no automatic deprovisioning, so a departing employee's access persists until a manual step nobody owns is completed.
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

        if organization.sso_enforced and organization.domain_verified:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO with a "
                f"verified domain."
            )
            if not organization.scim_enabled:
                report.status_extended += " SCIM provisioning is not enabled."
        elif organization.sso_enforced:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO but has "
                f"no verified domain."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not enforce SSO."
            )

        findings.append(report)
        return findings
